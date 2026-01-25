import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'hw-organizer-defaults';

export default function SetupView({ onStart }) {
    const [initials, setInitials] = useState('');
    const [className, setClassName] = useState('');
    const [week, setWeek] = useState('');

    // Load saved defaults on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved) {
                const { initials: savedInitials, className: savedClass } = JSON.parse(saved);
                if (savedInitials) setInitials(savedInitials);
                if (savedClass) setClassName(savedClass);
            }
        } catch (e) {
            console.warn('Could not load saved defaults:', e);
        }
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Save initials and class for next time
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ initials, className }));
        } catch (e) {
            console.warn('Could not save defaults:', e);
        }

        onStart({ initials: initials.trim(), className: className.trim(), week: week.trim() });
    };

    const isValid = initials.trim() && className.trim() && week.trim();

    return (
        <div className="glass-panel fade-in">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label" htmlFor="initials">Your Initials</label>
                    <input
                        type="text"
                        id="initials"
                        className="form-input"
                        placeholder="e.g. SZ"
                        value={initials}
                        onChange={(e) => setInitials(e.target.value.toUpperCase())}
                        maxLength={5}
                        autoComplete="off"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="className">Class Name</label>
                    <input
                        type="text"
                        id="className"
                        className="form-input"
                        placeholder="e.g. Calc2"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        maxLength={20}
                        autoComplete="off"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="week">Week Number</label>
                    <input
                        type="text"
                        id="week"
                        className="form-input"
                        placeholder="e.g. 2"
                        value={week}
                        onChange={(e) => setWeek(e.target.value)}
                        maxLength={5}
                        autoComplete="off"
                    />
                </div>

                <button type="submit" className="btn" disabled={!isValid}>
                    📸 Start Assignment
                </button>
            </form>
        </div>
    );
}
