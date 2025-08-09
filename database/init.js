const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Database path configuration
// Railway free tier can only write to /app directory
const dbPath = process.env.DB_FILE
  ? process.env.DB_FILE
  : (process.env.NODE_ENV === 'production'
      ? path.join(__dirname, 'project_manager.db')
      : path.join(__dirname, 'project_manager.db'));

let db;
let inMemoryData = null;

// In-memory data structure for Vercel fallback
const createInMemoryData = () => {
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const userPassword = bcrypt.hashSync('user123', 10);
  
  return {
    users: [
      {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password: adminPassword,
        full_name: 'Administrator',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        username: 'user',
        email: 'user@example.com',
        password: userPassword,
        full_name: 'Regular User',
        role: 'member',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    projects: [
      {
        id: 1,
        name: 'Website Redesign',
        description: 'Complete redesign of company website',
        status: 'active',
        priority: 'high',
        deadline: '2024-12-31',
        created_by: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    tasks: [
      {
        id: 1,
        title: 'Design Homepage',
        description: 'Create new homepage design',
        status: 'todo',
        priority: 'high',
        deadline: '2024-09-15',
        project_id: 1,
        assigned_to: 2,
        created_by: 1,
        estimated_hours: 8.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    comments: [],
    project_members: [
      { project_id: 1, user_id: 1, role: 'admin', joined_at: new Date().toISOString() },
      { project_id: 1, user_id: 2, role: 'member', joined_at: new Date().toISOString() }
    ]
  };
};

function createDatabase() {
  return new Promise((resolve, reject) => {
    try {
      console.log('Creating database connection at:', dbPath);
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error creating database connection:', err);
          reject(err);
          return;
        }
        console.log('Database connection created successfully');
        resolve(db);
      });
    } catch (error) {
      console.error('Error in createDatabase:', error);
      reject(error);
    }
  });
}

function initializeDatabase() {
  return new Promise(async (resolve, reject) => {
    try {
      // Try to create SQLite database
      console.log('Attempting to initialize SQLite database...');
      db = await createDatabase();
      
      console.log('Initializing database at:', dbPath);
      
      db.serialize(() => {
        // Create users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            avatar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            reject(err);
            return;
          }
          console.log('Users table created/verified');
        });

        // Create projects table
        db.run(`
          CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            priority TEXT DEFAULT 'medium',
            deadline DATE,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users (id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating projects table:', err);
            reject(err);
            return;
          }
          console.log('Projects table created/verified');
        });

        // Create tasks table
        db.run(`
          CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            deadline DATE,
            estimated_hours REAL,
            actual_hours REAL,
            project_id INTEGER,
            assigned_to INTEGER,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id),
            FOREIGN KEY (assigned_to) REFERENCES users (id),
            FOREIGN KEY (created_by) REFERENCES users (id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating tasks table:', err);
            reject(err);
            return;
          }
          console.log('Tasks table created/verified');
        });

        // Create comments table
        db.run(`
          CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            task_id INTEGER,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating comments table:', err);
            reject(err);
            return;
          }
          console.log('Comments table created/verified');
        });

        // Create notifications table
        db.run(`
          CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'personal',
            read INTEGER DEFAULT 0,
            sender_id INTEGER,
            sender_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating notifications table:', err);
            reject(err);
            return;
          }
          console.log('Notifications table created/verified');
        });
        // Create project_members table
        db.run(`
          CREATE TABLE IF NOT EXISTS project_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            user_id INTEGER,
            role TEXT DEFAULT 'member',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(project_id, user_id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating project_members table:', err);
            reject(err);
            return;
          }
          console.log('Project members table created/verified');
        });

        // Insert default admin user
        const adminPassword = bcrypt.hashSync('admin123', 10);
        db.run(`
          INSERT OR IGNORE INTO users (username, email, password, full_name, role)
          VALUES ('admin', 'admin@example.com', ?, 'Administrator', 'admin')
        `, [adminPassword], (err) => {
          if (err) {
            console.error('Error inserting admin user:', err);
          } else {
            console.log('Admin user created/verified');
          }
        });

        // Insert default user account
        const userPassword = bcrypt.hashSync('user123', 10);
        db.run(`
          INSERT OR IGNORE INTO users (username, email, password, full_name, role)
          VALUES ('user', 'user@example.com', ?, 'Regular User', 'member')
        `, [userPassword], (err) => {
          if (err) {
            console.error('Error inserting user account:', err);
          } else {
            console.log('User account created/verified');
          }
        });

        // Insert sample data
        db.run(`
          INSERT OR IGNORE INTO projects (name, description, status, priority, deadline, created_by)
          VALUES ('Website Redesign', 'Complete redesign of company website', 'active', 'high', '2024-12-31', 1)
        `, (err) => {
          if (err) {
            console.error('Error inserting sample project:', err);
          }
        });

        db.run(`
          INSERT OR IGNORE INTO tasks (title, description, status, priority, deadline, project_id, assigned_to, created_by, estimated_hours)
          VALUES ('Design Homepage', 'Create new homepage design', 'todo', 'high', '2024-09-15', 1, 2, 1, 8.0)
        `, (err) => {
          if (err) {
            console.error('Error inserting sample task:', err);
          }
        });

        db.run(`
          INSERT OR IGNORE INTO project_members (project_id, user_id, role)
          VALUES (1, 1, 'admin')
        `, (err) => {
          if (err) {
            console.error('Error inserting project member:', err);
          }
        });

        db.run(`
          INSERT OR IGNORE INTO project_members (project_id, user_id, role)
          VALUES (1, 2, 'member')
        `, (err) => {
          if (err) {
            console.error('Error inserting project member:', err);
          }
        });

        db.run('PRAGMA foreign_keys = ON');
        
        // Add a final callback to resolve the promise after all operations
        db.run('SELECT 1', (err) => {
          if (err) {
            console.error('Error in final database check:', err);
            reject(err);
            return;
          }
          console.log('Database initialization completed successfully');
          resolve();
        });
      });
    } catch (error) {
      console.error('SQLite initialization failed, falling back to in-memory storage:', error);
      
      // Fallback to in-memory storage for Vercel
      console.log('Initializing in-memory storage for Vercel deployment...');
      inMemoryData = createInMemoryData();
      console.log('In-memory storage initialized successfully');
      resolve();
    }
  });
}

function getDatabase() {
  if (db) {
    return db;
  }
  if (inMemoryData) {
    console.log('Using in-memory storage (Vercel fallback)');
    return inMemoryData;
  }
  console.error('Database not initialized. Call initializeDatabase() first.');
  return null;
}

// Helper functions for in-memory operations
function findUserByUsername(username) {
  if (!inMemoryData) return null;
  return inMemoryData.users.find(user => user.username === username);
}

function findUserById(id) {
  if (!inMemoryData) return null;
  return inMemoryData.users.find(user => user.id === id);
}

function getAllUsers() {
  if (!inMemoryData) return [];
  return inMemoryData.users;
}

function getAllProjects() {
  if (!inMemoryData) return [];
  return inMemoryData.projects;
}

function getAllTasks() {
  if (!inMemoryData) return [];
  return inMemoryData.tasks;
}

module.exports = {
  initializeDatabase,
  getDatabase,
  createDatabase,
  findUserByUsername,
  findUserById,
  getAllUsers,
  getAllProjects,
  getAllTasks
}; 