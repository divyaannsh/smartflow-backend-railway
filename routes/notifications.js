const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const emailService = require('../services/emailService');
const router = express.Router();

// Middleware to verify JWT token (aligned with auth.js)
const JWT_SECRET = process.env.JWT_SECRET || 'smartflow-ai-default-secret-key-2024';
// SSE clients per user
const sseClients = new Map();

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Send task assignment email
router.post('/task-assignment', verifyToken, [
  body('taskId').isInt().withMessage('Valid task ID is required'),
  body('userId').isInt().withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId, userId } = req.body;
    const db = getDatabase();

    // Get task details
    db.get('SELECT * FROM tasks WHERE id = ?', [taskId], async (err, task) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get user details
      db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Get project details
        db.get('SELECT * FROM projects WHERE id = ?', [task.project_id], async (err, project) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (!project) {
            return res.status(404).json({ error: 'Project not found' });
          }

          try {
            // Send email
            await emailService.sendTaskAssignmentEmail(
              user.email,
              user.full_name,
              task,
              project
            );

            res.json({ 
              message: 'Task assignment email sent successfully',
              taskId,
              userId,
              email: user.email
            });
          } catch (emailError) {
            console.error('Email sending error:', emailError);
            res.status(500).json({ error: 'Failed to send email notification' });
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in task assignment notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send deadline reminder email
router.post('/deadline-reminder', verifyToken, [
  body('taskId').isInt().withMessage('Valid task ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.body;
    const db = getDatabase();

    // Get task details with assigned user
    db.get(`
      SELECT t.*, u.email, u.full_name 
      FROM tasks t 
      JOIN users u ON t.assigned_to = u.id 
      WHERE t.id = ?
    `, [taskId], async (err, task) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get project details
      db.get('SELECT * FROM projects WHERE id = ?', [task.project_id], async (err, project) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        try {
          // Send email
          await emailService.sendDeadlineReminderEmail(
            task.email,
            task.full_name,
            task,
            project
          );

          res.json({ 
            message: 'Deadline reminder email sent successfully',
            taskId,
            email: task.email
          });
        } catch (emailError) {
          console.error('Email sending error:', emailError);
          res.status(500).json({ error: 'Failed to send email notification' });
        }
      });
    });
  } catch (error) {
    console.error('Error in deadline reminder notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send admin message email
router.post('/admin-message', verifyToken, [
  body('title').notEmpty().withMessage('Message title is required'),
  body('content').notEmpty().withMessage('Message content is required'),
  body('userIds').isArray().withMessage('User IDs array is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, userIds, isGeneral } = req.body;
    const db = getDatabase();

    // Get sender details
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, sender) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!sender) {
        return res.status(404).json({ error: 'Sender not found' });
      }

      // Get all users to send emails to
      const placeholders = userIds.map(() => '?').join(',');
      db.all(`SELECT * FROM users WHERE id IN (${placeholders})`, userIds, async (err, users) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const messageData = {
          title,
          content,
          senderName: sender.full_name,
          senderRole: sender.role
        };

        try {
          // Insert in-app notifications and push via SSE
          const db2 = getDatabase();
          const insertStmt = db2.prepare(`
            INSERT INTO notifications (user_id, title, message, type, read, sender_id, sender_name)
            VALUES (?, ?, ?, 'info', 0, ?, ?)
          `);
          const boxTitle = isGeneral ? `📣 ${title}` : `📢 ${title}`;
          const nType = isGeneral ? 'general' : 'personal';
          users.forEach(u => insertStmt.run([u.id, boxTitle, content, nType, sender.id, sender.full_name], function() {
            const set = sseClients.get(u.id);
            if (set) {
              const payload = JSON.stringify({
                id: this.lastID,
                title: boxTitle,
                message: content,
                type: nType,
                read: false,
                timestamp: new Date().toISOString(),
                senderName: sender.full_name
              });
              for (const client of set) {
                client.write(`event: notification\n`);
                client.write(`data: ${payload}\n\n`);
              }
            }

            // Keep only latest 5 notifications per user (delete older ones)
            db2.run(
              `DELETE FROM notifications 
               WHERE user_id = ? 
                 AND id NOT IN (
                   SELECT id FROM notifications 
                   WHERE user_id = ? 
                   ORDER BY created_at DESC, id DESC 
                   LIMIT 5
                 )`,
              [u.id, u.id],
              (err) => {
                if (err) {
                  console.error('Failed pruning old notifications for user', u.id, err);
                }
              }
            );
          }));
          insertStmt.finalize();

          // Send emails to all users as well
          const emailPromises = users.map(user => 
            emailService.sendAdminMessageEmail(user.email, user.full_name, messageData)
          );

          await Promise.all(emailPromises);

          res.json({ 
            message: 'Admin message sent (email + in-app)',
            sentTo: users.length,
            users: users.map(u => ({ id: u.id, email: u.email, name: u.full_name }))
          });
        } catch (emailError) {
          console.error('Email sending error:', emailError);
          res.status(500).json({ error: 'Failed to send email notifications' });
        }
      });
    });
  } catch (error) {
    console.error('Error in admin message notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send project update email
router.post('/project-update', verifyToken, [
  body('projectId').isInt().withMessage('Valid project ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId } = req.body;
    const db = getDatabase();

    // Get project details
    db.get('SELECT * FROM projects WHERE id = ?', [projectId], async (err, project) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get all users assigned to tasks in this project
      db.all(`
        SELECT DISTINCT u.* 
        FROM users u 
        JOIN tasks t ON u.id = t.assigned_to 
        WHERE t.project_id = ?
      `, [projectId], async (err, users) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Calculate project progress
        db.all('SELECT status FROM tasks WHERE project_id = ?', [projectId], (err, tasks) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          const totalTasks = tasks.length;
          const completedTasks = tasks.filter(t => t.status === 'done').length;
          const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

          const projectData = {
            ...project,
            progress: Math.round(progress)
          };

          try {
            // Send emails to all project members
            const emailPromises = users.map(user => 
              emailService.sendProjectUpdateEmail(user.email, user.full_name, projectData)
            );

            Promise.all(emailPromises).then(() => {
              res.json({ 
                message: 'Project update emails sent successfully',
                sentTo: users.length,
                projectId,
                progress
              });
            }).catch(emailError => {
              console.error('Email sending error:', emailError);
              res.status(500).json({ error: 'Failed to send email notifications' });
            });
          } catch (emailError) {
            console.error('Email sending error:', emailError);
            res.status(500).json({ error: 'Failed to send email notifications' });
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in project update notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send welcome email
router.post('/welcome-email', verifyToken, [
  body('userId').isInt().withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;
    const db = getDatabase();

    // Get user details
    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      try {
        // Send welcome email
        await emailService.sendWelcomeEmail(user.email, user.full_name, user);

        res.json({ 
          message: 'Welcome email sent successfully',
          userId,
          email: user.email
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        res.status(500).json({ error: 'Failed to send welcome email' });
      }
    });
  } catch (error) {
    console.error('Error in welcome email notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test email configuration
router.get('/test-connection', verifyToken, async (req, res) => {
  try {
    const isConnected = await emailService.testConnection();
    
    if (isConnected) {
      res.json({ 
        message: 'Email service is connected and ready',
        status: 'connected'
      });
    } else {
      res.status(500).json({ 
        error: 'Email service connection failed',
        status: 'disconnected'
      });
    }
  } catch (error) {
    console.error('Error testing email connection:', error);
    res.status(500).json({ error: 'Failed to test email connection' });
  }
});

// Get notification settings
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    // Get user's notification preferences (you can extend this)
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        emailNotifications: true, // Default to true
        taskAssignments: true,
        deadlineReminders: true,
        adminMessages: true,
        projectUpdates: true,
        email: user.email
      });
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 

// In-app notifications API
router.get('/', verifyToken, (req, res) => {
  try {
    const db = getDatabase();
    db.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows.map(r => ({
          id: r.id,
          title: r.title,
          message: r.message,
          type: r.type,
          read: !!r.read,
          timestamp: r.created_at,
          senderName: r.sender_name,
        })));
      }
    );
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/read', verifyToken, (req, res) => {
  try {
    const db = getDatabase();
    db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
      res.json({ message: 'Marked as read' });
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/read-all', verifyToken, (req, res) => {
  try {
    const db = getDatabase();
    db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'All marked as read' });
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', verifyToken, (req, res) => {
  try {
    const db = getDatabase();
    db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
      res.json({ message: 'Notification deleted' });
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SSE stream
router.get('/stream', async (req, res) => {
  // Get token from query parameter since EventSource doesn't support headers
  const token = req.query.token;
  
  if (!token) {
    console.log('SSE Stream: No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('SSE Stream: Token verified for user:', decoded.id);
  } catch (error) {
    console.log('SSE Stream: Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.flushHeaders();

  const userId = req.user.id;
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  const clientSet = sseClients.get(userId);
  clientSet.add(res);
  
  console.log('SSE Stream: Client connected for user:', userId);

  req.on('close', () => {
    clientSet.delete(res);
    if (clientSet.size === 0) sseClients.delete(userId);
    console.log('SSE Stream: Client disconnected for user:', userId);
  });
});