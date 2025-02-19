import { useState, useRef } from 'react';
import { config } from './config';
import './App.css';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // You'll need to install these packages: npm install jspdf jspdf-autotable

function App() {
  const [activeTab, setActiveTab] = useState('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [questionFormData, setQuestionFormData] = useState({
    subject: '',
    difficultyLevel: 'MEDIUM',
    grade: '',
    questionsFor: 'COGAT',
    numberOfQuestions: 5
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = activeTab === 'login' 
        ? `${config.apiUrl}/api/auth/login`
        : `${config.apiUrl}/api/auth/signup`;

      const requestBody = activeTab === 'login'
        ? {
            username: formData.username,
            password: formData.password
          }
        : {
            username: formData.username,
            email: formData.email,
            password: formData.password
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      if (activeTab === 'login') {
        setIsAuthenticated(true);
      } else {
        setActiveTab('login');
        setFormData({
          username: '',
          email: '',
          password: ''
        });
        alert('Successfully signed up! Please login.');
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/api/json/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(questionFormData)
      });

      if (!response.ok) throw new Error('Failed to generate questions');

      const data = await response.json();
      setQuestions(data.questions);
      setShowPreview(true);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate questions');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(16);
      doc.text(`Questions for ${questionFormData.questionsFor}`, 14, 15);
      doc.setFontSize(12);
      doc.text(`Grade: ${questionFormData.grade} | Difficulty: ${questionFormData.difficultyLevel}`, 14, 25);
      
      let yPos = 35;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 14;
      const maxWidth = pageWidth - 2 * margin;

      // First, add all questions with options
      questions.forEach((q, index) => {
        const questionText = `${index + 1}. ${q.question}`;
        const splitQuestion = doc.splitTextToSize(questionText, maxWidth);
        doc.text(splitQuestion, margin, yPos);
        
        yPos += 10 * splitQuestion.length;

        q.options.forEach((option) => {
          const optionText = doc.splitTextToSize(option, maxWidth - 10);
          doc.text(optionText, margin + 5, yPos);
          yPos += 7 * optionText.length;
        });

        yPos += 10;

        if (yPos > doc.internal.pageSize.height - 20) {
          doc.addPage();
          yPos = 20;
        }
      });

      // Add a new page for answers
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Answer Key', 14, 15);
      doc.setFontSize(12);
      
      yPos = 35;

      questions.forEach((q, index) => {
        const answerText = `${index + 1}. ${q.options.find(opt => 
          opt.startsWith(q.correctAnswer)
        )}`;
        
        const splitAnswer = doc.splitTextToSize(answerText, maxWidth);
        doc.text(splitAnswer, margin, yPos);
        yPos += 10 * splitAnswer.length;

        if (yPos > doc.internal.pageSize.height - 20) {
          doc.addPage();
          yPos = 20;
        }
      });

      return doc;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  const handlePreviewPDF = () => {
    const doc = generatePDF();
    if (doc) {
      const pdfBlob = doc.output('bloburl');
      setPdfPreview(pdfBlob);
      setShowPdfPreview(true);
    } else {
      alert('Failed to generate PDF preview');
    }
  };

  const handleSavePDF = () => {
    const doc = generatePDF();
    if (doc) {
      const fileName = `questions_${questionFormData.questionsFor.toLowerCase()}_grade${questionFormData.grade}.pdf`;
      doc.save(fileName);
      setShowPdfPreview(false);
    } else {
      alert('Failed to save PDF');
    }
  };

  const handleSendEmail = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/pdf/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          questions,
          email: questionFormData.email // Add email field to questionFormData if not present
        })
      });

      if (!response.ok) throw new Error('Failed to send email');

      alert('Email sent successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setFormData({
      username: '',
      email: '',
      password: ''
    });
  };

  const QuestionPreview = ({ questions }) => {
    const totalQuestions = questions.length;
    const currentQuestion = questions[currentQuestionIndex];

    const handleNext = () => {
      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setShowAnswer(false); // Reset answer visibility for new question
      }
    };

    const handlePrevious = () => {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(prev => prev - 1);
        setShowAnswer(false); // Reset answer visibility for new question
      }
    };

    const handleCheckAnswer = () => {
      setShowAnswer(true);
    };

    return (
      <div className="preview-container">
        <h2>Preview Questions</h2>
        
        <div className="pagination-info">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </div>

        <div className="question-card">
          <p className="question-text">
            <span className="question-number">{currentQuestionIndex + 1}.</span> 
            {currentQuestion.question}
          </p>
          <div className="options-grid">
            {currentQuestion.options.map((option, optIndex) => (
              <div 
                key={optIndex} 
                className={`option ${showAnswer && option.startsWith(currentQuestion.correctAnswer) ? 'correct' : ''}`}
              >
                {option}
              </div>
            ))}
          </div>

          <div className="answer-section">
            {!showAnswer ? (
              <button 
                onClick={handleCheckAnswer}
                className="check-answer-button"
              >
                Check Answer
              </button>
            ) : (
              <div className="answer-reveal">
                <span className="answer-label">Correct Answer:</span> 
                {currentQuestion.options.find(opt => 
                  opt.startsWith(currentQuestion.correctAnswer)
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pagination-controls">
          <button 
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="pagination-button"
          >
            ← Previous
          </button>
          
          <div className="pagination-dots">
            {questions.map((_, index) => (
              <span 
                key={index}
                className={`pagination-dot ${index === currentQuestionIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentQuestionIndex(index);
                  setShowAnswer(false);
                }}
              />
            ))}
          </div>

          <button 
            onClick={handleNext}
            disabled={currentQuestionIndex === totalQuestions - 1}
            className="pagination-button"
          >
            Next →
          </button>
        </div>

        <div className="action-buttons">
          <button 
            onClick={handlePreviewPDF} 
            className="action-button preview-button"
          >
            Preview PDF
          </button>
          <button 
            onClick={handleSendEmail}
            disabled={isLoading}
            className="action-button email-button"
          >
            {isLoading ? 'Sending...' : 'Send via Email'}
          </button>
          <button 
            onClick={() => {
              setShowPreview(false);
              setCurrentQuestionIndex(0);
              setShowAnswer(false);
            }}
            className="action-button back-button"
          >
            Back to Form
          </button>
        </div>
      </div>
    );
  };

  const PDFPreview = () => (
    <div className="pdf-preview-overlay">
      <div className="pdf-preview-container">
        <div className="pdf-preview-header">
          <h3>PDF Preview</h3>
          <button 
            className="close-preview-button"
            onClick={() => setShowPdfPreview(false)}
          >
            ×
          </button>
        </div>
        <div className="pdf-preview-content">
          <iframe
            src={pdfPreview}
            title="PDF Preview"
            width="100%"
            height="100%"
          />
        </div>
        <div className="pdf-preview-actions">
          <button 
            onClick={() => setShowPdfPreview(false)}
            className="action-button back-button"
          >
            Back
          </button>
          <button 
            onClick={handleSavePDF}
            className="action-button save-button"
          >
            Save PDF
          </button>
        </div>
      </div>
    </div>
  );

  if (isAuthenticated) {
    return (
      <div className="page-container">
        <div className={`question-form-container ${showPreview ? 'preview-mode' : ''}`}>
          <div className="header">
            <h1 className="title">Question Generator</h1>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>

          {showPreview && questions ? (
            <QuestionPreview questions={questions} />
          ) : (
            <form onSubmit={handleQuestionSubmit} className="question-form">
              <div className="form-group">
                <label>Subject:</label>
                <input
                  type="text"
                  name="subject"
                  value={questionFormData.subject}
                  onChange={(e) => setQuestionFormData(prev => ({
                    ...prev,
                    subject: e.target.value
                  }))}
                  required
                  className="form-input"
                  placeholder="Enter subject"
                />
              </div>

              <div className="form-group">
                <label>Difficulty Level:</label>
                <select
                  name="difficultyLevel"
                  value={questionFormData.difficultyLevel}
                  onChange={(e) => setQuestionFormData(prev => ({
                    ...prev,
                    difficultyLevel: e.target.value
                  }))}
                  required
                  className="form-select"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="DIFFICULT">Difficult</option>
                </select>
              </div>

              <div className="form-group">
                <label>Grade:</label>
                <input
                  type="number"
                  name="grade"
                  min="1"
                  max="12"
                  value={questionFormData.grade}
                  onChange={(e) => setQuestionFormData(prev => ({
                    ...prev,
                    grade: e.target.value
                  }))}
                  required
                  className="form-input"
                  placeholder="1-12"
                />
              </div>

              <div className="form-group">
                <label>Questions For:</label>
                <select
                  name="questionsFor"
                  value={questionFormData.questionsFor}
                  onChange={(e) => setQuestionFormData(prev => ({
                    ...prev,
                    questionsFor: e.target.value
                  }))}
                  required
                  className="form-select"
                >
                  <option value="COGAT">COGAT</option>
                  <option value="FRISCO_ISD">Frisco ISD</option>
                  <option value="PLANO_ISD">Plano ISD</option>
                </select>
              </div>

              <div className="form-group">
                <label>Number of Questions:</label>
                <input
                  type="number"
                  name="numberOfQuestions"
                  min="1"
                  max="10"
                  value={questionFormData.numberOfQuestions}
                  onChange={(e) => setQuestionFormData(prev => ({
                    ...prev,
                    numberOfQuestions: e.target.value
                  }))}
                  required
                  className="form-input"
                  placeholder="1-10"
                />
              </div>

              <button type="submit" disabled={isLoading} className="submit-button">
                {isLoading ? (
                  <span className="loading-text">
                    <span className="spinner"></span>
                    Generating...
                  </span>
                ) : (
                  'Generate PDF'
                )}
              </button>
            </form>
          )}
        </div>
        {showPdfPreview && <PDFPreview />}
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user types
  };

  return (
    <div className="page-container">
      <div className="auth-box">
        <h1 className="auth-title">Question Generator</h1>
        
        <div className="auth-tabs">
          <button 
            type="button"
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
          >
            Login
          </button>
          <button 
            type="button"
            className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('signup');
              setError('');
            }}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleAuthSubmit}>
          <div className="form-field">
            <label>Username:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              required
              disabled={isLoading}
            />
          </div>

          {activeTab === 'signup' && (
            <div className="form-field">
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-field">
            <label>Password:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-text">
                <span className="spinner"></span>
                {activeTab === 'login' ? 'Logging in...' : 'Signing up...'}
              </span>
            ) : (
              activeTab === 'login' ? 'Login' : 'Sign Up'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;