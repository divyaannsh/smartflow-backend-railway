const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getDatabase, findUserByUsername, getAllUsers, findUserById } = require('../database/init');

const router = express.Router();

// JWT secret with default value
const JWT_SECRET = process.env.JWT_SECRET || 'smartflow-ai-default-secret-key-2024';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// Login route with added console logs
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { username, password } = req.body;
    console.log('Login attempt for username:', username);

    const db = getDatabase();
    let user = null;

    if (db && typeof db.get === 'function') {
      // SQLite database
      console.log('Using SQLite database for authentication');
      user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
          if (err) {
            console.error('Database error:', err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    } else {
      // In-memory storage
      console.log('Using in-memory storage for authentication');
      user = findUserByUsername(username);
    }

    console.log('User found:', user ? 'Yes' : 'No');
    if (user) { 
      console.log('User role:', user.role); 
    }
    if (!user) { 
      console.log('No user found with username:', username); 
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    console.log('Password match:', passwordMatch);
    if (!passwordMatch) { 
      console.log('Password verification failed for username:', username); 
    }

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        full_name: user.full_name 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', username, 'Role:', user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Register route
router.post('/register', [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('role').isIn(['admin', 'manager', 'member']).withMessage('Valid role is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { username, email, password, full_name, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    const db = getDatabase();
    let existingUser = null;

    if (db && typeof db.get === 'function') {
      // SQLite database
      existingUser = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    } else {
      // In-memory storage
      const users = getAllUsers();
      existingUser = users.find(u => u.username === username || u.email === email);
    }

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    if (db && typeof db.run === 'function') {
      // SQLite database: create user, then return token + user
      const insertedId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
          [username, email, hashedPassword, full_name, role],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          }
        );
      });

      const createdUser = await new Promise((resolve, reject) => {
        db.get('SELECT id, username, email, full_name, role FROM users WHERE id = ?', [insertedId], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });

      const token = jwt.sign(
        {
          id: createdUser.id,
          username: createdUser.username,
          role: createdUser.role,
          full_name: createdUser.full_name
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: createdUser
      });
    } else {
      // In-memory storage: create user and return token + user (non-persistent)
      const users = getAllUsers();
      const newId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;
      const newUser = {
        id: newId,
        username,
        email,
        password: hashedPassword,
        full_name,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      users.push(newUser);

      const publicUser = { id: newUser.id, username, email, full_name, role };
      const token = jwt.sign(
        {
          id: publicUser.id,
          username: publicUser.username,
          role: publicUser.role,
          full_name: publicUser.full_name
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: publicUser
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Verify token route
router.get('/verify', verifyToken, (req, res) => {
  res.json({ 
    message: 'Token is valid', 
    user: req.user 
  });
});

// Current user route
router.get('/me', verifyToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    if (db && typeof db.get === 'function') {
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT id, username, email, full_name, role FROM users WHERE id = ?', [userId], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json(user);
    } else {
      const user = findUserById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const { id, username, email, full_name, role } = user;
      return res.json({ id, username, email, full_name, role });
    }
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Failed to fetch current user' });
  }
});

// Debug endpoint to check users (remove in production)
router.get('/debug/users', (req, res) => {
  try {
    const db = getDatabase();
    let users = [];

    if (db && typeof db.all === 'function') {
      // SQLite database
      db.all('SELECT id, username, email, full_name, role FROM users', (err, rows) => {
        if (err) {
          console.error('Error fetching users:', err);
          res.status(500).json({ error: 'Failed to fetch users' });
        } else {
          res.json({ users: rows });
        }
      });
    } else {
      // In-memory storage
      users = getAllUsers().map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }));
      res.json({ users });
    }
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug endpoint failed' });
  }
});

module.exports = router; 