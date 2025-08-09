const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const router = express.Router();

// Get all tasks with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      project_id, 
      assigned_to, 
      status, 
      priority, 
      search,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;
    
    const db = getDatabase();
    let query = `
      SELECT t.*, 
             p.name as project_name,
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (project_id) {
      query += ' AND t.project_id = ?';
      params.push(project_id);
    }
    
    if (assigned_to) {
      query += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }
    
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    
    if (priority) {
      query += ' AND t.priority = ?';
      params.push(priority);
    }
    
    if (search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY t.${sort_by} ${sort_order}`;
    
    db.all(query, params, (err, tasks) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(tasks);
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const query = `
      SELECT t.*, 
             p.name as project_name,
             u1.full_name as assigned_to_name,
             u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `;
    
    db.get(query, [id], (err, task) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new task
router.post('/', [
  body('title').notEmpty().withMessage('Task title is required'),
  body('description').optional(),
  body('priority').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status'),
  body('deadline').optional().isISO8601().withMessage('Invalid deadline format'),
  body('project_id').isInt().withMessage('Valid project ID is required'),
  body('assigned_to').optional().isInt().withMessage('Valid user ID is required'),
  body('estimated_hours').optional().isFloat().withMessage('Estimated hours must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      title, 
      description, 
      priority, 
      status, 
      deadline, 
      project_id, 
      assigned_to, 
      estimated_hours 
    } = req.body;
    
    const created_by = req.user?.id || 1; // Default to admin if no auth

    const db = getDatabase();
    const query = `
      INSERT INTO tasks (title, description, priority, status, deadline, project_id, assigned_to, created_by, estimated_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [title, description, priority, status, deadline, project_id, assigned_to, created_by, estimated_hours], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get the created task
      db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err, task) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json(task);
      });
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/:id', [
  body('title').optional().notEmpty().withMessage('Task title cannot be empty'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status'),
  body('deadline').optional().isISO8601().withMessage('Invalid deadline format'),
  body('estimated_hours').optional().isFloat().withMessage('Estimated hours must be a number'),
  body('actual_hours').optional().isFloat().withMessage('Actual hours must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { 
      title, 
      description, 
      status, 
      priority, 
      deadline, 
      assigned_to, 
      estimated_hours, 
      actual_hours 
    } = req.body;

    const db = getDatabase();
    const query = `
      UPDATE tasks 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          deadline = COALESCE(?, deadline),
          assigned_to = COALESCE(?, assigned_to),
          estimated_hours = COALESCE(?, estimated_hours),
          actual_hours = COALESCE(?, actual_hours),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [title, description, status, priority, deadline, assigned_to, estimated_hours, actual_hours, id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Get the updated task
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(task);
      });
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      res.json({ message: 'Task deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task status
router.patch('/:id/status', [
  body('status').isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;
    const db = getDatabase();
    
    db.run('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      res.json({ message: 'Task status updated successfully', status });
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task comments
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const query = `
      SELECT c.*, u.full_name as user_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `;
    
    db.all(query, [id], (err, comments) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(comments);
    });
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to task
router.post('/:id/comments', [
  body('content').notEmpty().withMessage('Comment content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { content } = req.body;
    const user_id = req.user?.id || 1; // Default to admin if no auth
    const db = getDatabase();
    
    db.run('INSERT INTO comments (content, task_id, user_id) VALUES (?, ?, ?)', [content, id, user_id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get the created comment
      db.get('SELECT * FROM comments WHERE id = ?', [this.lastID], (err, comment) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json(comment);
      });
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get task statistics
router.get('/stats/overview', async (req, res) => {
  try {
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
    `;
    
    db.get(query, [], (err, stats) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(stats);
    });
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 