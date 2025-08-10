import { Coffee, Loader } from 'lucide-react';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <Loader className="animate-spin h-5 w-5 text-primary" />
  </div>
);

export default LoadingSpinner;
