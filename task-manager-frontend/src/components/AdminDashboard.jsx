// src/components/AdminDashboard.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import validator from "validator"; // For sanitization
import { FaEye, FaEyeSlash } from "react-icons/fa";

const AdminDashboard = ({ setIsAuthenticated, setUserRole }) => {
  const [activeSection, setActiveSection] = useState("todo");
  const [personalTasks, setPersonalTasks] = useState([]);
  const [userTasks, setUserTasks] = useState([]); // For assigned tasks in createTask section
  const [userEmail, setUserEmail] = useState("Loading...");
  const [csrfToken, setCsrfToken] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [userTaskInput, setUserTaskInput] = useState("");
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

  // Validation for task input (personal tasks)
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
    try {
      const response = await axios.get("/csrf-token");
      setCsrfToken(response.data.csrfToken);
      console.log("CSRF token fetched:", response.data.csrfToken);
    } catch (error) {
      console.error("Error fetching CSRF token:", error);
      alert("Failed to load page security. Please refresh and try again.");
    }
  };

  // Load profile data
  const loadProfile = async () => {
    try {
      const response = await axios.get("/adminMe");
      setUserEmail(response.data.email);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login"); // Redirect to user dashboard if unauthorized for admin
      } else if (error.response?.status === 403) {
        navigate("/dashboard"); // Redirect to login if not authenticated
      }
      console.error("Error loading profile:", error);
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

  // Load all assigned tasks (for admins)
  const loadUserTasks = async () => {
    try {
      const response = await axios.get("/user-tasks");
      setUserTasks(response.data.tasks || []);
    } catch (error) {
      console.error("Error loading user tasks:", error);
      setUserTasks([]);
    }
  };

  // Handle section switching
  const showSection = (section) => {
    setActiveSection(section);
    if (section === "todo") {
      loadPersonalTasks();
    } else if (section === "createTask") {
      loadUserTasks();
    }
  };

  // Add personal task
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
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      alert("Task created successfully");
      setTaskInput("");
      fetchCsrfToken(); // Refresh token
      loadPersonalTasks();
    } catch (error) {
      alert(error.response?.data?.error || "Error adding task");
    }
  };

  // Create task for user (admin) - No validation
  const createTask = async () => {
    if (!csrfToken) {
      alert("Security token not loaded. Please wait or refresh the page.");
      return;
    }
    try {
      await axios.post(
        "/create-task",
        {
          username: usernameInput,
          task: userTaskInput,
        },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      alert("Task assigned successfully");
      setUsernameInput("");
      setUserTaskInput("");
      fetchCsrfToken(); // Refresh token
      loadUserTasks();
    } catch (error) {
      alert(error.response?.data?.error || "Error creating task");
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
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      fetchCsrfToken(); // Refresh token
      loadPersonalTasks();
    } catch (error) {
      alert(error.response?.data?.error || "Error deleting task");
    }
  };

  // Export tasks as CSV
  const exportTasks = () => {
    const template = `
- tasks.forEach(task => {
  = '"' + task.taskID + '","' + task.task + '","' + task.assignedTo + '"\\n'
- })
`;
    const url = `/api/export-csv?template=${encodeURIComponent(template)}`;
    window.location.href = url;
  };

  // Change password
  const handleChangePassword = async () => {
    try {
      const response = await axios.post(
        "/change-password",
        {
          newPassword: newPassword,
        },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      alert(response.data.message || response.data.error);
      if (response.data.message) {
        logout();
      }
    } catch (error) {
      alert(error.response?.data?.error || "Error changing password");
    }
  };

  // // Logout
  const logout = async () => {
    try {
      await axios.post(
        "/logout",
        {},
        {
          withCredentials: true,
        }
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
        <h2>Admin Dashboard</h2>
        <ul>
          <li
            className={activeSection === "todo" ? "active" : ""}
            onClick={() => showSection("todo")}
          >
            To-Do List
          </li>
          <li
            className={activeSection === "createTask" ? "active" : ""}
            onClick={() => showSection("createTask")}
          >
            Create Task for User
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

        {/* Create Task for User Section */}
        {activeSection === "createTask" && (
          <section className="dashboard-section">
            <h2>Create Task for User</h2>
            <div className="dashboard-task-input">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter username..."
              />
              <input
                type="text"
                value={userTaskInput}
                onChange={(e) => setUserTaskInput(e.target.value)}
                placeholder="Enter task..."
              />
              <button onClick={createTask}>Create Task</button>
            </div>
            <div className="dashboard-export-section">
              <button className="dashboard-export-btn" onClick={exportTasks}>
                Export Tasks as CSV
              </button>
            </div>

            <h3>All Assigned Tasks</h3>
            <ul className="dashboard-task-list">
              {userTasks.length > 0 ? (
                userTasks.map((task) => {
                  const statusClass =
                    task.status === "completed"
                      ? "dashboard-status-completed"
                      : "dashboard-status-pending";
                  const statusText =
                    task.status === "completed" ? "Completed" : "Pending";
                  return (
                    <li key={task.id}>
                      <span className="task-title">
                        <span className="task-part">Task: {task.task}</span>
                        <span className="task-assignee">
                          Assigned to: {task.username}
                        </span>
                        <span className="task-status">
                          Status:{" "}
                          <span className={statusClass}>{statusText}</span>
                        </span>
                      </span>
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

export default AdminDashboard;
