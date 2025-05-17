import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await axios.get("/api/user", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                });
                setUser(res.data);
            } catch (err) {
                navigate("/dashboard");
            }
        };

        const fetchLeaderboard = async () => {
            const res = await axios.get("/api/leaderboard");
            setLeaderboard(res.data);
        };

        fetchUser();
        fetchLeaderboard();
    }, [navigate]);

    const handleCreateGame = () => {
        navigate("/game"); // redirect to Game page
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-4 rounded-2xl shadow">
                <h2 className="text-2xl font-semibold">👤 Profilul tău</h2>
                {user ? (
                    <div className="mt-2">
                        <p><strong>Nume:</strong> {user.name}</p>
                        <p><strong>Scor total:</strong> {user.score}</p>
                    </div>
                ) : (
                    <p>Se încarcă...</p>
                )}
            </div>

            <div className="bg-white p-4 rounded-2xl shadow">
                <h2 className="text-2xl font-semibold">🏆 Leaderboard</h2>
                <ul className="mt-2">
                    {leaderboard.map((entry, index) => (
                        <li key={entry._id} className="flex justify-between py-1">
                            <span>{index + 1}. {entry.name}</span>
                            <span>{entry.score} puncte</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="text-center">
                <button
                    onClick={handleCreateGame}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700"
                >
                    🎮 Creează un nou joc
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
