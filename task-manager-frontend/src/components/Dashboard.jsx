// src/components/Dashboard.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import validator from "validator"; // For sanitization/validation
import "./Dashboard.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Dashboard = ({ setIsAuthenticated, setUserRole }) => {
  const [activeSection, setActiveSection] = useState("todo");
  const [personalTasks, setPersonalTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [userEmail, setUserEmail] = useState("Loading...");
  const [csrfToken, setCsrfToken] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  // const apiUrl = import.meta.env.VITE_API_URL;
  axios.defaults.baseURL = "/api";
  axios.defaults.withCredentials = true;

  // Sanitization function
  const sanitizeInput = (input) => {
    return validator.escape(input.trim());
  };

  // Validation for task input
  const validateTaskInput = () => {
    const newErrors = {};
    if (!taskInput.trim()) {
      newErrors.task = "Task cannot be empty.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validation for password change
  const validatePasswordChange = () => {
    const newErrors = {};
    if (!newPassword.trim()) {
      newErrors.newPassword = "New password is required.";
    } else if (newPassword.length < 6) {
      newErrors.newPassword =
        "New password must be at least 6 characters long.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Fetch CSRF token
  const fetchCsrfToken = async () => {
    console.log("Starting CSRF token fetch..."); // Add this
    try {
      const response = await axios.get("/csrf-token");
      console.log("Response received:", response.data); // Add this
      setCsrfToken(response.data.csrfToken);
      console.log("CSRF token fetched:", response.data.csrfToken);
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      console.log("Error details:", error.response); // Add this for more info
      alert("Failed to load page security. Please refresh and try again.");
    }
  };

  // Load user profile
  const loadProfile = async () => {
    try {
      const response = await axios.get("/me");
      setUserEmail(response.data.email);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login"); // Not logged in → go to login
      } else if (error.response?.status === 403) {
        // Forbidden (e.g., wrong role) → redirect to appropriate dashboard or error
        navigate("/admin-dashboard"); // Or '/admin-dashboard' if user is admin but accessing user page
      } else {
        console.error("Error loading profile:", error);
        // Optional: Handle other errors (e.g., 500) with a generic message
      }
    }
  };

  // Load personal tasks
  const loadPersonalTasks = async () => {
    try {
      const response = await axios.get("/get-tasks?assigned=0");
      setPersonalTasks(response.data.tasks || []);
    } catch (error) {
      console.error("Error loading personal tasks:", error);
      setPersonalTasks([]);
    }
  };

  // Load assigned tasks
  const loadAssignedTasks = async () => {
    try {
      const response = await axios.get("/get-tasks?assigned=1");
      setAssignedTasks(response.data.tasks || []);
    } catch (error) {
      console.error("Error loading assigned tasks:", error);
      setAssignedTasks([]);
    }
  };

  // Handle section switching
  const showSection = (section) => {
    setActiveSection(section);
    if (section === "todo") {
      loadPersonalTasks();
    } else if (section === "assignedTasks") {
      loadAssignedTasks();
    }
  };

  // Add task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!validateTaskInput()) return;
    if (!csrfToken) {
      alert("Security token not loaded. Please wait or refresh the page.");
      return;
    }
    const sanitizedTask = sanitizeInput(taskInput);
    try {
      await axios.post(
        "/create-task",
        {
          task: sanitizedTask,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        },
      );
      alert("Task created successfully");
      setTaskInput("");
      fetchCsrfToken(); // Refresh token
      loadPersonalTasks();
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.error || "Error adding task");
    }
  };

  // Delete task
  const deleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    if (!csrfToken) {
      alert("Security token not loaded. Please wait or refresh the page.");
      return;
    }
    try {
      await axios.post(
        "/delete-task",
        {
          taskId,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        },
      );
      fetchCsrfToken(); // Refresh token
      loadPersonalTasks();
    } catch (error) {
      alert(error.response?.data?.error || "Error deleting task");
    }
  };

  // Mark task as done
  const markDone = async (taskId) => {
    if (!csrfToken) {
      alert("Security token not loaded. Please wait or refresh the page.");
      return;
    }
    try {
      await axios.post(
        "/mark-done",
        {
          taskId,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        },
      );
      fetchCsrfToken();
      loadAssignedTasks();
    } catch (error) {
      alert(error.response?.data?.error || "Error marking task as done");
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!validatePasswordChange()) return;
    try {
      const response = await axios.post(
        "/change-password",
        {
          newPassword: newPassword,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      if (response.data.message) {
        alert(response.data.message);
        logout();
      }
    } catch (error) {
      console.error(
        "change-password failed:",
        error.response?.status,
        error.response?.data,
      );
      setErrors((prev) => ({
        ...prev,
        newPassword: "Could not update password.",
      }));
    }
  };

  const logout = async () => {
    try {
      await axios.post(
        "/logout",
        {},
        {
          withCredentials: true,
        },
      );
      // Clear client-side state
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userRole");
      setIsAuthenticated(false); // Update app state
      setUserRole(null);
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      // Even on error, clear state and redirect to prevent stuck state
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userRole");
      setIsAuthenticated(false);
      setUserRole(null);
      navigate("/login");
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      await fetchCsrfToken();
      await loadProfile();
      await loadPersonalTasks();
    };
    init();
  }, []);

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <h1>NewtBug</h1>
        <h4>Task-Manager</h4>
        <h2>Dashboard</h2>
        <ul>
          <li
            className={activeSection === "todo" ? "active" : ""}
            onClick={() => showSection("todo")}
          >
            To-Do List
          </li>

          <li
            className={activeSection === "assignedTasks" ? "active" : ""}
            onClick={() => showSection("assignedTasks")}
          >
            Assigned Tasks
          </li>

          <li
            className={activeSection === "profile" ? "active" : ""}
            onClick={() => showSection("profile")}
          >
            Profile
          </li>

          <li onClick={logout}>Logout</li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="dashboard-content">
        {/* To-Do Section */}
        {activeSection === "todo" && (
          <section className="dashboard-section">
            <h2>Your Tasks</h2>

            <form onSubmit={handleAddTask}>
              <div className="dashboard-task-input">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Enter a new task..."
                  required
                />
                <button type="submit">Add</button>
              </div>
              {errors.task && (
                <span className="dashboard-error">{errors.task}</span>
              )}
            </form>

            <ul className="dashboard-task-list">
              {personalTasks.length > 0 ? (
                personalTasks.map((task) => (
                  <li key={task.id}>
                    <span className="task-title">{task.task}</span>
                    <button
                      className="dashboard-delete"
                      onClick={() => deleteTask(task.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))
              ) : (
                <li className="empty-state">No personal tasks.</li>
              )}
            </ul>
          </section>
        )}

        {/* Assigned Tasks Section */}
        {activeSection === "assignedTasks" && (
          <section className="dashboard-section">
            <h2>Assigned Tasks</h2>

            <ul className="dashboard-task-list">
              {assignedTasks.length > 0 ? (
                assignedTasks.map((task) => {
                  const statusClass =
                    task.status === "completed"
                      ? "dashboard-status-completed"
                      : "dashboard-status-pending";

                  return (
                    <li key={task.id}>
                      <span className="task-title">
                        {task.task}{" "}
                        <span className={statusClass}>{task.status}</span>
                      </span>

                      {task.status !== "completed" && (
                        <button
                          className="dashboard-mark-done"
                          onClick={() => markDone(task.id)}
                        >
                          Mark as Done
                        </button>
                      )}
                    </li>
                  );
                })
              ) : (
                <li className="empty-state">No assigned tasks.</li>
              )}
            </ul>
          </section>
        )}

        {/* Profile Section */}
        {activeSection === "profile" && (
          <section className="dashboard-section">
            <h2>Profile</h2>

            <div className="dashboard-profile-box">
              <p>
                <strong>Email:</strong> {userEmail}
              </p>

              <h3>Change Password</h3>

              <div className="password-input-container">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  className="password-input"
                />
                <span
                  className="password-toggle-icon"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label="Toggle new password visibility"
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
              {errors.newPassword && (
                <span className="dashboard-error">{errors.newPassword}</span>
              )}

              <button onClick={handleChangePassword}>Update Password</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
