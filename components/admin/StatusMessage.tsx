import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface StatusMessageProps {
  type: "success" | "error" | "loading" | "info";
  message: string;
  details?: string;
}

export function StatusMessage({ type, message, details }: StatusMessageProps) {
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      textColor: "text-green-800 dark:text-green-200",
      iconColor: "text-green-600",
      detailsColor: "text-green-700 dark:text-green-300",
    },
    error: {
      icon: AlertCircle,
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-800",
      textColor: "text-red-800 dark:text-red-200",
      iconColor: "text-red-600",
      detailsColor: "text-red-700 dark:text-red-300",
    },
    loading: {
      icon: Loader2,
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      textColor: "text-blue-800 dark:text-blue-200",
      iconColor: "text-blue-600 animate-spin",
      detailsColor: "text-blue-700 dark:text-blue-300",
    },
    info: {
      icon: AlertCircle,
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      textColor: "text-blue-800 dark:text-blue-200",
      iconColor: "text-blue-600",
      detailsColor: "text-blue-700 dark:text-blue-300",
    },
  };

  const { icon: Icon, bgColor, borderColor, textColor, iconColor, detailsColor } = config[type];

  return (
    <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
      <div className="flex items-center space-x-3">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <span className={textColor}>{message}</span>
      </div>
      {details && <div className={`mt-2 text-sm ${detailsColor}`}>{details}</div>}
    </div>
  );
}
