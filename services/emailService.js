const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const path = require('path');
const fs = require('fs');

// Email templates
const emailTemplates = {
  taskAssignment: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>New Task Assignment</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .task-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .priority-high { border-left: 4px solid #dc3545; }
        .priority-medium { border-left: 4px solid #ffc107; }
        .priority-low { border-left: 4px solid #28a745; }
        .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 New Task Assignment</h1>
            <p>You have been assigned a new task in SmartFlow AI</p>
        </div>
        <div class="content">
            <div class="task-card priority-{{priority}}">
                <h2>{{taskTitle}}</h2>
                <p><strong>Project:</strong> {{projectName}}</p>
                <p><strong>Priority:</strong> <span style="color: {{priorityColor}};">{{priority}}</span></p>
                <p><strong>Deadline:</strong> {{deadline}}</p>
                <p><strong>Description:</strong></p>
                <p>{{description}}</p>
                <a href="{{taskUrl}}" class="btn">View Task</a>
            </div>
            <div class="footer">
                <p>This is an automated notification from SmartFlow AI</p>
                <p>© 2024 SmartFlow AI - Intelligent Project Management</p>
            </div>
        </div>
    </div>
</body>
</html>
  `,

  deadlineReminder: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Deadline Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .task-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #dc3545; }
        .btn { display: inline-block; padding: 12px 24px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Deadline Reminder</h1>
            <p>You have a task due soon in SmartFlow AI</p>
        </div>
        <div class="content">
            <div class="task-card">
                <h2>{{taskTitle}}</h2>
                <p><strong>Project:</strong> {{projectName}}</p>
                <p><strong>Priority:</strong> <span style="color: {{priorityColor}};">{{priority}}</span></p>
                <p><strong>Due Date:</strong> <span style="color: #dc3545; font-weight: bold;">{{deadline}}</span></p>
                <p><strong>Time Remaining:</strong> <span style="color: #dc3545; font-weight: bold;">{{timeRemaining}}</span></p>
                <p><strong>Description:</strong></p>
                <p>{{description}}</p>
                <a href="{{taskUrl}}" class="btn">View Task</a>
            </div>
            <div class="footer">
                <p>This is an automated reminder from SmartFlow AI</p>
                <p>© 2024 SmartFlow AI - Intelligent Project Management</p>
            </div>
        </div>
    </div>
</body>
</html>
  `,

  adminMessage: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Admin Message</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .message-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📢 Admin Message</h1>
            <p>You have received a message from your administrator</p>
        </div>
        <div class="content">
            <div class="message-card">
                <h2>{{messageTitle}}</h2>
                <p><strong>From:</strong> {{senderName}} ({{senderRole}})</p>
                <p><strong>Date:</strong> {{messageDate}}</p>
                <p><strong>Message:</strong></p>
                <p>{{messageContent}}</p>
                <a href="{{dashboardUrl}}" class="btn">View Dashboard</a>
            </div>
            <div class="footer">
                <p>This is an automated notification from SmartFlow AI</p>
                <p>© 2024 SmartFlow AI - Intelligent Project Management</p>
            </div>
        </div>
    </div>
</body>
</html>
  `,

  projectUpdate: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Project Update</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .project-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .progress-bar { background: #e9ecef; border-radius: 10px; height: 20px; margin: 10px 0; }
        .progress-fill { background: linear-gradient(90deg, #28a745 0%, #20c997 100%); height: 100%; border-radius: 10px; transition: width 0.3s; }
        .btn { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📈 Project Update</h1>
            <p>Your project has been updated in SmartFlow AI</p>
        </div>
        <div class="content">
            <div class="project-card">
                <h2>{{projectName}}</h2>
                <p><strong>Status:</strong> <span style="color: {{statusColor}};">{{status}}</span></p>
                <p><strong>Priority:</strong> <span style="color: {{priorityColor}};">{{priority}}</span></p>
                <p><strong>Progress:</strong> {{progress}}%</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {{progress}}%;"></div>
                </div>
                <p><strong>Description:</strong></p>
                <p>{{description}}</p>
                <a href="{{projectUrl}}" class="btn">View Project</a>
            </div>
            <div class="footer">
                <p>This is an automated notification from SmartFlow AI</p>
                <p>© 2024 SmartFlow AI - Intelligent Project Management</p>
            </div>
        </div>
    </div>
</body>
</html>
  `,

  welcomeEmail: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to SmartFlow AI</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .welcome-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Welcome to SmartFlow AI</h1>
            <p>Your intelligent project management platform</p>
        </div>
        <div class="content">
            <div class="welcome-card">
                <h2>Hello {{userName}}!</h2>
                <p>Welcome to SmartFlow AI, your intelligent project management platform. We're excited to have you on board!</p>
                
                <h3>What you can do:</h3>
                <ul>
                    <li>📋 Manage your tasks and projects</li>
                    <li>👥 Collaborate with your team</li>
                    <li>📊 Track your progress and productivity</li>
                    <li>🤖 Get AI-powered assistance</li>
                    <li>📱 Access from anywhere, anytime</li>
                </ul>
                
                <p><strong>Your Role:</strong> {{userRole}}</p>
                <p><strong>Username:</strong> {{username}}</p>
                
                <a href="{{loginUrl}}" class="btn">Get Started</a>
            </div>
            <div class="footer">
                <p>This is an automated welcome email from SmartFlow AI</p>
                <p>© 2024 SmartFlow AI - Intelligent Project Management</p>
            </div>
        </div>
    </div>
</body>
</html>
  `
};

// Compile templates
const compiledTemplates = {};
Object.keys(emailTemplates).forEach(templateName => {
  compiledTemplates[templateName] = handlebars.compile(emailTemplates[templateName]);
});

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password'
  }
};

// Check if we're in development mode with default credentials
const isDevelopmentMode = !process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com';

// Create transporter
const transporter = isDevelopmentMode ? null : nodemailer.createTransport(emailConfig);

// Email service class
class EmailService {
  constructor() {
    this.transporter = transporter;
    this.templates = compiledTemplates;
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@smartflowai.com';
    this.fromName = process.env.FROM_NAME || 'SmartFlow AI';
  }

  // Send email with template
  async sendEmail(to, subject, templateName, data) {
    try {
      const template = this.templates[templateName];
      if (!template) {
        throw new Error(`Template ${templateName} not found`);
      }

      const html = template(data);
      
      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: to,
        subject: subject,
        html: html
      };

      // In development mode, log the email instead of sending
      if (isDevelopmentMode) {
        console.log('📧 DEVELOPMENT MODE - Email would be sent:');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Template:', templateName);
        console.log('Data:', JSON.stringify(data, null, 2));
        console.log('---');
        return { messageId: 'dev-mode-' + Date.now() };
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Send task assignment email
  async sendTaskAssignmentEmail(userEmail, userName, taskData, projectData) {
    const priorityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745'
    };

    const data = {
      taskTitle: taskData.title,
      projectName: projectData.name,
      priority: taskData.priority,
      priorityColor: priorityColors[taskData.priority] || '#6c757d',
      deadline: taskData.deadline ? new Date(taskData.deadline).toLocaleDateString() : 'No deadline',
      description: taskData.description || 'No description provided',
      taskUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks/${taskData.id}`
    };

    return this.sendEmail(
      userEmail,
      `🎯 New Task Assignment: ${taskData.title}`,
      'taskAssignment',
      data
    );
  }

  // Send deadline reminder email
  async sendDeadlineReminderEmail(userEmail, userName, taskData, projectData) {
    const priorityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745'
    };

    const deadline = new Date(taskData.deadline);
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    let timeRemaining;
    if (daysRemaining === 0) {
      timeRemaining = 'Due today!';
    } else if (daysRemaining === 1) {
      timeRemaining = 'Due tomorrow!';
    } else if (daysRemaining < 0) {
      timeRemaining = `${Math.abs(daysRemaining)} days overdue!`;
    } else {
      timeRemaining = `${daysRemaining} days remaining`;
    }

    const data = {
      taskTitle: taskData.title,
      projectName: projectData.name,
      priority: taskData.priority,
      priorityColor: priorityColors[taskData.priority] || '#6c757d',
      deadline: deadline.toLocaleDateString(),
      timeRemaining: timeRemaining,
      description: taskData.description || 'No description provided',
      taskUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks/${taskData.id}`
    };

    return this.sendEmail(
      userEmail,
      `⏰ Deadline Reminder: ${taskData.title}`,
      'deadlineReminder',
      data
    );
  }

  // Send admin message email
  async sendAdminMessageEmail(userEmail, userName, messageData) {
    const data = {
      messageTitle: messageData.title || 'Admin Message',
      senderName: messageData.senderName,
      senderRole: messageData.senderRole || 'Administrator',
      messageDate: new Date().toLocaleDateString(),
      messageContent: messageData.content,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal`
    };

    return this.sendEmail(
      userEmail,
      `📢 Admin Message: ${messageData.title || 'New Message'}`,
      'adminMessage',
      data
    );
  }

  // Send project update email
  async sendProjectUpdateEmail(userEmail, userName, projectData) {
    const statusColors = {
      active: '#28a745',
      completed: '#6c757d',
      on_hold: '#ffc107'
    };

    const priorityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745'
    };

    const data = {
      projectName: projectData.name,
      status: projectData.status,
      statusColor: statusColors[projectData.status] || '#6c757d',
      priority: projectData.priority,
      priorityColor: priorityColors[projectData.priority] || '#6c757d',
      progress: projectData.progress || 0,
      description: projectData.description || 'No description provided',
      projectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${projectData.id}`
    };

    return this.sendEmail(
      userEmail,
      `📈 Project Update: ${projectData.name}`,
      'projectUpdate',
      data
    );
  }

  // Send welcome email
  async sendWelcomeEmail(userEmail, userName, userData) {
    const data = {
      userName: userName,
      userRole: userData.role,
      username: userData.username,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
    };

    return this.sendEmail(
      userEmail,
      `🚀 Welcome to SmartFlow AI, ${userName}!`,
      'welcomeEmail',
      data
    );
  }

  // Send bulk emails (for admin broadcasts)
  async sendBulkEmails(emails, subject, templateName, data) {
    const promises = emails.map(email => 
      this.sendEmail(email, subject, templateName, data)
    );
    
    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      
      console.log(`Bulk email sent: ${successful} successful, ${failed} failed`);
      return { successful, failed, total: emails.length };
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      throw error;
    }
  }

  // Test email configuration
  async testConnection() {
    try {
      if (isDevelopmentMode) {
        console.log('📧 DEVELOPMENT MODE - Email service is in development mode');
        return true;
      }
      
      await this.transporter.verify();
      console.log('Email service is ready');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

// Create and export email service instance
const emailService = new EmailService();

module.exports = emailService; 