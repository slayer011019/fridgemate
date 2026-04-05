import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="card text-sm muted">{'\uC138\uC158\uC744 \uD655\uC778\uD558\uB294 \uC911\uC785\uB2C8\uB2E4...'}</div>;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;
