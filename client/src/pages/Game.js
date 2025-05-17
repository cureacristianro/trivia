import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Game = () => {
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30); // 30 secunde pentru fiecare întrebare
    const navigate = useNavigate();

    useEffect(() => {
        // Fetch întrebările din API
        const fetchQuestions = async () => {
            const res = await axios.get("/api/questions");
            setQuestions(res.data);
        };

        fetchQuestions();
    }, []);

    useEffect(() => {
        // Dacă mai sunt întrebări, începe timer-ul
        if (timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearInterval(timer); // curăță intervalul
        } else {
            // Dacă timpul a expirat, mergi la următoarea întrebare
            handleNextQuestion();
        }
    }, [timeLeft]);

    const handleAnswer = (isCorrect) => {
        if (isCorrect) {
            setScore(score + 1);
        }
        handleNextQuestion();
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setTimeLeft(30); // resetare timer
        } else {
            // Finalizează jocul și trimite scorul
            alert(`Jocul s-a încheiat! Scorul tău este: ${score}`);
            navigate("/dashboard");
        }
    };

    if (questions.length === 0) {
        return <div>Se încarcă întrebările...</div>;
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-4 rounded-2xl shadow">
                <h2 className="text-2xl font-semibold">🎮 Jocul tău</h2>
                <div className="mt-2">
                    <p><strong>Întrebare:</strong> {currentQuestion.question}</p>
                    <div className="mt-4">
                        {currentQuestion.answers.map((answer, index) => (
                            <button
                                key={index}
                                className="bg-blue-600 text-white px-6 py-2 rounded-xl my-2 w-full"
                                onClick={() => handleAnswer(answer.correct)}
                            >
                                {answer.text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow">
                <p><strong>Scor:</strong> {score}</p>
                <p><strong>Timp rămas:</strong> {timeLeft} secunde</p>
            </div>
        </div>
    );
};

export default Game;
