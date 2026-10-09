import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-island-dark via-island to-island-dark p-4">
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4 text-white">404</h1>
      <p className="text-xl text-gray-300 mb-4">Page not found</p>
      <Link to="/" className="text-love hover:underline">Return to Love Islander</Link>
    </div>
  </div>
);

export default NotFound;
