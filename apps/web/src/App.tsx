// apps/web/src/App.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import TaskListPage from "./TaskListPage";
import TaskDetailPage from "./TaskDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TaskListPage />} />
      <Route path="/tasks/:id" element={<TaskDetailPage />} />
    </Routes>
  );
}
