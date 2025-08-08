import { Coffee } from 'lucide-react';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="relative flex items-center justify-center">
      <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-primary"></div>
      <Coffee className="absolute h-8 w-8 text-primary" />
    </div>
  </div>
);

export default LoadingSpinner;
