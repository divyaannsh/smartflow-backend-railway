const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const router = express.Router();
// Add team member to a project
router.post('/:id/members', [
  body('user_id').isInt({ min: 1 }).withMessage('Valid user_id is required'),
  body('role').optional().isIn(['admin', 'manager', 'member']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { user_id, role = 'member' } = req.body;

    const db = getDatabase();
    const insert = `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (?, ?, ?)
    `;

    db.run(insert, [id, user_id, role], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'User is already a member of this project' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.status(201).json({ id: this.lastID, project_id: Number(id), user_id, role });
    });
  } catch (error) {
    console.error('Error adding project member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List project members
router.get('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const query = `
      SELECT pm.project_id, pm.user_id, pm.role, pm.joined_at, u.full_name, u.email
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY u.full_name ASC
    `;
    db.all(query, [id], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Get all projects
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const query = `
      SELECT p.*, u.full_name as created_by_name,
             COUNT(t.id) as total_tasks,
             COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    
    db.all(query, [], (err, projects) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(projects);
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const query = `
      SELECT p.*, u.full_name as created_by_name
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `;
    
    db.get(query, [id], (err, project) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new project
router.post('/', [
  body('name').notEmpty().withMessage('Project name is required'),
  body('description').optional(),
  body('priority').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('deadline').optional().isISO8601().withMessage('Invalid deadline format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, priority, deadline } = req.body;
    const created_by = req.user?.id || 1; // Default to admin if no auth

    const db = getDatabase();
    const query = `
      INSERT INTO projects (name, description, priority, deadline, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(query, [name, description, priority, deadline, created_by], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get the created project
      db.get('SELECT * FROM projects WHERE id = ?', [this.lastID], (err, project) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json(project);
      });
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Project name cannot be empty'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('deadline').optional().isISO8601().withMessage('Invalid deadline format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, status, priority, deadline } = req.body;

    const db = getDatabase();
    const query = `
      UPDATE projects 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          deadline = COALESCE(?, deadline),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [name, description, status, priority, deadline, id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Get the updated project
      db.get('SELECT * FROM projects WHERE id = ?', [id], (err, project) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(project);
      });
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if project has tasks
    db.get('SELECT COUNT(*) as count FROM tasks WHERE project_id = ?', [id], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete project with existing tasks. Please delete or reassign tasks first.' 
        });
      }
      
      // Delete project
      db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json({ message: 'Project deleted successfully' });
      });
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete project with all its tasks
router.delete('/:id/with-tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Start a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Delete all tasks for this project
      db.run('DELETE FROM tasks WHERE project_id = ?', [id], function(err) {
        if (err) {
          console.error('Database error deleting tasks:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Database error deleting tasks' });
        }
        
        // Delete the project
        db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
          if (err) {
            console.error('Database error deleting project:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Database error deleting project' });
          }
          
          if (this.changes === 0) {
            db.run('ROLLBACK');
            return res.status(404).json({ error: 'Project not found' });
          }
          
          // Commit the transaction
          db.run('COMMIT', function(err) {
            if (err) {
              console.error('Database error committing transaction:', err);
              return res.status(500).json({ error: 'Database error committing transaction' });
            }
            
            res.json({ message: 'Project and all associated tasks deleted successfully' });
          });
        });
      });
    });
  } catch (error) {
    console.error('Error deleting project with tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project statistics
router.get('/:id/stats', async (req, res) => {
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
        SUM(estimated_hours) as total_estimated_hours,
        SUM(actual_hours) as total_actual_hours
      FROM tasks 
      WHERE project_id = ?
    `;
    
    db.get(query, [id], (err, stats) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(stats);
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 