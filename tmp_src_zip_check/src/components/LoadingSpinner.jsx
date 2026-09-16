export default function LoadingSpinner({ fullScreen = false, size = 'medium', text = 'טוען נתונים...' }) {
    const sizeClasses = {
        small: 'w-5 h-5 border-2',
        medium: 'w-8 h-8 border-3',
        large: 'w-12 h-12 border-4',
    };

    const spinner = (
        <div className="flex flex-col items-center gap-3">
            <div className={`${sizeClasses[size]} border-gray-200 border-t-[#526f52] rounded-full animate-spin`}></div>
            {text && <p className="text-gray-500 text-sm font-medium animate-pulse">{text}</p>}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                {spinner}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8 w-full">
            {spinner}
        </div>
    );
}
