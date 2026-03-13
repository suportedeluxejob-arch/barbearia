import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Admin from './pages/Admin';
import BookBarber from './pages/BookBarber';
import BookService from './pages/BookService';
import BookDateTime from './pages/BookDateTime';
import Profile from './pages/Profile';
import History from './pages/History';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/book/barber" element={<ProtectedRoute><BookBarber /></ProtectedRoute>} />
          <Route path="/book/service" element={<ProtectedRoute><BookService /></ProtectedRoute>} />
          <Route path="/book/datetime" element={<ProtectedRoute><BookDateTime /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
