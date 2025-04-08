const PORT = 8000;
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://cristiancurea03:<db_password>@triviagocluster.rpkhubj.mongodb.net/';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const app = express();
app.use(cors());
app.use(express.json());

// Database collections
const collections = {
    USERS: 'users',
    QUESTIONS: 'trivia-questions',
    GAMES: 'trivia-games',
    LEADERBOARD: 'leaderboard'
};

// Connect to MongoDB
async function connectToDatabase() {
    const client = new MongoClient(uri);
    await client.connect();
    return client;
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- AUTHENTICATION ENDPOINTS ---
app.post('/auth/register', async (req, res) => {
    const client = await connectToDatabase();
    const { username, email, password } = req.body;

    try {
        const database = client.db('app-data');
        const users = database.collection(collections.USERS);

        // Check if user exists
        const existingUser = await users.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(409).send('User with this email or username already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const createdAt = new Date().toISOString();

        // Create user
        const userData = {
            user_id: userId,
            username,
            email: email.toLowerCase(),
            hashed_password: hashedPassword,
            created_at: createdAt,
            last_login: createdAt,
            stats: {
                total_games: 0,
                wins: 0,
                average_score: 0,
                total_points: 0,
                fastest_answer: null
            },
            preferences: {
                theme: 'light',
                notifications: true
            }
        };

        await users.insertOne(userData);

        // Generate token
        const token = jwt.sign({ userId, email, username }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            token,
            user: {
                id: userId,
                username,
                email,
                created_at: createdAt
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

app.post('/auth/login', async (req, res) => {
    const client = await connectToDatabase();
    const { email, password } = req.body;

    try {
        const database = client.db('app-data');
        const users = database.collection(collections.USERS);

        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).send('Invalid credentials');
        }

        const validPassword = await bcrypt.compare(password, user.hashed_password);
        if (!validPassword) {
            return res.status(401).send('Invalid credentials');
        }

        // Update last login
        await users.updateOne(
            { user_id: user.user_id },
            { $set: { last_login: new Date().toISOString() } }
        );

        // Generate token
        const token = jwt.sign(
            { userId: user.user_id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            token,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

// --- USER ENDPOINTS ---
app.get('/users/me', authenticateToken, async (req, res) => {
    const client = await connectToDatabase();

    try {
        const database = client.db('app-data');
        const users = database.collection(collections.USERS);

        const user = await users.findOne({ user_id: req.user.userId });
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Remove sensitive data
        delete user.hashed_password;

        res.status(200).json(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

app.get('/users/:userId', async (req, res) => {
    const client = await connectToDatabase();
    const { userId } = req.params;

    try {
        const database = client.db('app-data');
        const users = database.collection(collections.USERS);

        const user = await users.findOne({ user_id: userId });
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Return public profile only
        const publicProfile = {
            id: user.user_id,
            username: user.username,
            stats: user.stats
        };

        res.status(200).json(publicProfile);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

// --- QUESTION ENDPOINTS ---
app.get('/questions', async (req, res) => {
    const client = await connectToDatabase();
    const { category, difficulty, limit = 10, random = true } = req.query;

    try {
        const database = client.db('app-data');
        const questions = database.collection(collections.QUESTIONS);

        // Build query
        const query = {};
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;

        // Get questions
        let questionQuery = questions.find(query);

        if (random) {
            questionQuery = questionQuery.limit(parseInt(limit));
        } else {
            questionQuery = questionQuery.limit(parseInt(limit));
        }

        const results = await questionQuery.toArray();

        if (random) {
            // Simple shuffle for demo purposes
            results.sort(() => Math.random() - 0.5);
        }

        res.status(200).json(results.slice(0, limit));
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

// --- GAME ENDPOINTS ---
app.post('/games', authenticateToken, async (req, res) => {
    const client = await connectToDatabase();
    const { board, questions, max_players = 4 } = req.body;

    try {
        const database = client.db('app-data');
        const games = database.collection(collections.GAMES);
        const users = database.collection(collections.USERS);

        // Get user info
        const user = await users.findOne({ user_id: req.user.userId });
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Create game
        const gameId = uuidv4();
        const createdAt = new Date().toISOString();

        const defaultBoard = {
            cells: 20,
            bonus_cells: [3, 7, 12, 17],
            penalty_cells: [2, 5, 9, 15]
        };

        const gameData = {
            game_id: gameId,
            creator_id: req.user.userId,
            status: 'waiting',
            board_config: board || defaultBoard,
            question_filters: questions || {},
            max_players,
            players: [{
                user_id: req.user.userId,
                username: user.username,
                score: 0,
                position: 0,
                color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                last_answer: null
            }],
            current_question: null,
            created_at: createdAt,
            started_at: null,
            finished_at: null
        };

        await games.insertOne(gameData);

        res.status(201).json({
            id: gameId,
            status: 'waiting',
            players: gameData.players,
            current_question: null,
            created_at: createdAt
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

app.get('/games', async (req, res) => {
    const client = await connectToDatabase();

    try {
        const database = client.db('app-data');
        const games = database.collection(collections.GAMES);

        const activeGames = await games.find({ status: { $in: ['waiting', 'active'] } }).toArray();

        const simplifiedGames = activeGames.map(game => ({
            id: game.game_id,
            status: game.status,
            players: game.players,
            current_question: game.current_question,
            created_at: game.created_at
        }));

        res.status(200).json(simplifiedGames);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

app.get('/games/:gameId', async (req, res) => {
    const client = await connectToDatabase();
    const { gameId } = req.params;

    try {
        const database = client.db('app-data');
        const games = database.collection(collections.GAMES);

        const game = await games.findOne({ game_id: gameId });
        if (!game) {
            return res.status(404).send('Game not found');
        }

        // Create board state
        const boardState = [];
        for (let i = 0; i < game.board_config.cells; i++) {
            let cellType = 'normal';
            if (game.board_config.bonus_cells.includes(i)) cellType = 'bonus';
            if (game.board_config.penalty_cells.includes(i)) cellType = 'penalty';

            const playersHere = game.players.filter(p => p.position === i).map(p => p.user_id);

            boardState.push({
                position: i,
                type: cellType,
                players: playersHere
            });
        }

        const gameDetails = {
            ...game,
            board_state: boardState
        };

        res.status(200).json(gameDetails);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

app.post('/games/:gameId/join', authenticateToken, async (req, res) => {
    const client = await connectToDatabase();
    const { gameId } = req.params;

    try {
        const database = client.db('app-data');
        const games = database.collection(collections.GAMES);
        const users = database.collection(collections.USERS);

        // Get game and user
        const game = await games.findOne({ game_id: gameId });
        if (!game) {
            return res.status(404).send('Game not found');
        }

        if (game.status !== 'waiting') {
            return res.status(409).send('Game has already started');
        }

        if (game.players.length >= game.max_players) {
            return res.status(409).send('Game is full');
        }

        const user = await users.findOne({ user_id: req.user.userId });
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Check if user is already in the game
        if (game.players.some(p => p.user_id === req.user.userId)) {
            return res.status(409).send('Already joined this game');
        }

        // Add player to game
        const newPlayer = {
            user_id: req.user.userId,
            username: user.username,
            score: 0,
            position: 0,
            color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
            last_answer: null
        };

        await games.updateOne(
            { game_id: gameId },
            { $push: { players: newPlayer } }
        );

        res.status(200).json({
            id: gameId,
            status: game.status,
            players: [...game.players, newPlayer],
            current_question: game.current_question,
            created_at: game.created_at
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

app.post('/games/:gameId/play', authenticateToken, async (req, res) => {
    const client = await connectToDatabase();
    const { gameId } = req.params;
    const { question_id, answer } = req.body;

    try {
        const database = client.db('app-data');
        const games = database.collection(collections.GAMES);
        const questions = database.collection(collections.QUESTIONS);
        const users = database.collection(collections.USERS);

        // Get game, question and user
        const game = await games.findOne({ game_id: gameId });
        if (!game) {
            return res.status(404).send('Game not found');
        }

        if (game.status !== 'active') {
            return res.status(400).send('Game is not active');
        }

        const question = await questions.findOne({ id: question_id });
        if (!question) {
            return res.status(404).send('Question not found');
        }

        const user = await users.findOne({ user_id: req.user.userId });
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Find player in game
        const playerIndex = game.players.findIndex(p => p.user_id === req.user.userId);
        if (playerIndex === -1) {
            return res.status(403).send('Not a player in this game');
        }

        const player = game.players[playerIndex];
        const isCorrect = question.correct_answer === answer;
        const now = new Date();

        // Calculate score change
        let scoreChange = 0;
        let answerTime = 0; // Initialize answerTime

        if (isCorrect) {
            // Base points based on difficulty
            const difficultyPoints = {
                easy: 10,
                medium: 20,
                hard: 30
            };

            scoreChange = difficultyPoints[question.difficulty] || 10;

            // Calculate answer time if question has a start time
            if (game.current_question && game.current_question.started_at) {
                answerTime = (now - new Date(game.current_question.started_at)) / 1000;

                // Bonus for fast answers
                if (answerTime < 5) {
                    scoreChange += Math.floor((5 - answerTime) * 2);
                }
            }

            // Update fastest answer stat if applicable
            if (answerTime > 0 && (!user.stats.fastest_answer || answerTime < user.stats.fastest_answer)) {
                await users.updateOne(
                    { user_id: req.user.userId },
                    { $set: { 'stats.fastest_answer': answerTime } }
                );
            }
        }

        // Move player position
        let newPosition = player.position;
        if (isCorrect) {
            newPosition += 1;

            // Check for bonus/penalty cells
            const boardConfig = game.board_config;
            if (boardConfig.bonus_cells.includes(newPosition)) {
                newPosition += 1; // Bonus: move extra step
                scoreChange += 5;
            } else if (boardConfig.penalty_cells.includes(newPosition)) {
                newPosition = Math.max(0, newPosition - 1); // Penalty: move back
                scoreChange = Math.max(0, scoreChange - 5);
            }
        }

        // Check if player reached the end
        const hasWon = newPosition >= game.board_config.cells;

        // Update game state
        const update = {
            $set: {
                [`players.${playerIndex}.score`]: player.score + scoreChange,
                [`players.${playerIndex}.position`]: hasWon ? game.board_config.cells : newPosition,
                [`players.${playerIndex}.last_answer`]: now.toISOString()
            }
        };

        if (hasWon) {
            update.$set.status = 'finished';
            update.$set.finished_at = now.toISOString();

            // Update user stats for the winner
            await users.updateOne(
                { user_id: req.user.userId },
                {
                    $inc: {
                        'stats.total_games': 1,
                        'stats.wins': 1,
                        'stats.total_points': player.score + scoreChange
                    }
                }
            );

            // Recalculate average score for winner
            const updatedUser = await users.findOne({ user_id: req.user.userId });
            const newAverage = updatedUser.stats.total_points / updatedUser.stats.total_games;
            await users.updateOne(
                { user_id: req.user.userId },
                { $set: { 'stats.average_score': newAverage } }
            );

            // Update other players' stats
            for (const p of game.players) {
                if (p.user_id !== req.user.userId) {
                    await users.updateOne(
                        { user_id: p.user_id },
                        {
                            $inc: {
                                'stats.total_games': 1,
                                'stats.total_points': p.score
                            }
                        }
                    );

                    // Recalculate average score for other players
                    const otherUser = await users.findOne({ user_id: p.user_id });
                    const otherNewAverage = otherUser.stats.total_points / otherUser.stats.total_games;
                    await users.updateOne(
                        { user_id: p.user_id },
                        { $set: { 'stats.average_score': otherNewAverage } }
                    );
                }
            }
        }

        await games.updateOne({ game_id: gameId }, update);

        // Get next question if game continues
        let nextQuestion = null;
        if (!hasWon) {
            const questionQuery = {};

            // Apply filters if they exist
            if (game.question_filters.categories) {
                questionQuery.category = { $in: game.question_filters.categories };
            }
            if (game.question_filters.difficulties) {
                questionQuery.difficulty = { $in: game.question_filters.difficulties };
            }

            const availableQuestions = await questions.find(questionQuery).toArray();
            if (availableQuestions.length > 0) {
                nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

                await games.updateOne(
                    { game_id: gameId },
                    {
                        $set: {
                            current_question: {
                                ...nextQuestion,
                                started_at: now.toISOString()
                            }
                        }
                    }
                );
            }
        }

        res.status(200).json({
            correct: isCorrect,
            score_change: scoreChange,
            new_position: hasWon ? game.board_config.cells : newPosition,
            next_question: hasWon ? null : nextQuestion,
            game_over: hasWon
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

// --- LEADERBOARD ENDPOINTS ---
app.get('/leaderboard', async (req, res) => {
    const client = await connectToDatabase();
    const { period = 'alltime' } = req.query;

    try {
        const database = client.db('app-data');
        const users = database.collection(collections.USERS);

        // For a real implementation, you'd want a separate leaderboard collection
        // that tracks scores over time periods. This is a simplified version.
        const leaderboard = await users.find()
            .sort({ 'stats.total_points': -1 })
            .limit(100)
            .project({
                username: 1,
                'stats.total_points': 1,
                'stats.wins': 1,
                'stats.average_score': 1
            })
            .toArray();

        const formattedLeaderboard = leaderboard.map((user, index) => ({
            user: {
                id: user.user_id,
                username: user.username,
                stats: {
                    total_points: user.stats.total_points,
                    wins: user.stats.wins,
                    average_score: user.stats.average_score
                }
            },
            rank: index + 1,
            score: user.stats.total_points,
            games_won: user.stats.wins
        }));

        res.status(200).json(formattedLeaderboard);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'healthy', message: 'TriviaGO API is running' });
});

app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));