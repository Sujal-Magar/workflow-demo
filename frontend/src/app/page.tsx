"use client";
import React, { useEffect, useState } from "react";
export default function Home() {
  const [status, setStatus] = useState("Checking backend...");
  useEffect(() => {
    fetch("http://localhost:4000/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.message))
      .catch(() => setStatus("Backend unreachable"));
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">Expense Tracker</h1>
      <p>Status: {status}</p>
    </div>
  );
}
