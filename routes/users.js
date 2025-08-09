const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/init');
const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const query = `
      SELECT id, username, email, full_name, role, avatar, created_at
      FROM users
      ORDER BY full_name ASC
    `;
    
    db.all(query, [], (err, users) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(users);
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const query = `
      SELECT id, username, email, full_name, role, avatar, created_at
      FROM users
      WHERE id = ?
    `;
    
    db.get(query, [id], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user
router.post('/', [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('role').isIn(['admin', 'manager', 'member']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, full_name, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const db = getDatabase();
    
    const query = `
      INSERT INTO users (username, email, password, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(query, [username, email, hashedPassword, full_name, role], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get the created user (without password)
      db.get('SELECT id, username, email, full_name, role, avatar, created_at FROM users WHERE id = ?', [this.lastID], (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json(user);
      });
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:id', [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('role').optional().isIn(['admin', 'manager', 'member']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { email, full_name, role, avatar } = req.body;
    const db = getDatabase();
    
    const query = `
      UPDATE users 
      SET email = COALESCE(?, email),
          full_name = COALESCE(?, full_name),
          role = COALESCE(?, role),
          avatar = COALESCE(?, avatar),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [email, full_name, role, avatar, id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get the updated user
      db.get('SELECT id, username, email, full_name, role, avatar, created_at FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(user);
      });
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if user has assigned tasks
    db.get('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ?', [id], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete user with assigned tasks. Please reassign tasks first.' 
        });
      }
      
      // Delete user
      db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'User deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user workload
router.get('/:id/workload', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const query = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'review' THEN 1 END) as review_tasks,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as done_tasks,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_tasks,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_tasks,
        COUNT(CASE WHEN deadline < DATE('now') AND status != 'done' THEN 1 END) as overdue_tasks,
        SUM(estimated_hours) as total_estimated_hours,
        SUM(actual_hours) as total_actual_hours
      FROM tasks 
      WHERE assigned_to = ?
    `;
    
    db.get(query, [id], (err, workload) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(workload);
    });
  } catch (error) {
    console.error('Error fetching user workload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's assigned tasks
router.get('/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.query;
    const db = getDatabase();
    
    let query = `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.assigned_to = ?
    `;
    
    const params = [id];
    
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    
    if (priority) {
      query += ' AND t.priority = ?';
      params.push(priority);
    }
    
    query += ' ORDER BY t.priority DESC, t.deadline ASC';
    
    db.all(query, params, (err, tasks) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(tasks);
    });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change user password
router.patch('/:id/password', [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { current_password, new_password } = req.body;
    const db = getDatabase();
    
    // Get current user
    db.get('SELECT password FROM users WHERE id = ?', [id], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify current password
      if (!bcrypt.compareSync(current_password, user.password)) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password
      const hashedPassword = bcrypt.hashSync(new_password, 10);
      
      // Update password
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ message: 'Password updated successfully' });
      });
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 