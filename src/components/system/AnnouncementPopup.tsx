export type AnnouncementContent = {
    id: string;
    title: string;
    description: string;
    buttons?: Array<{
        text: string;
        url: string;
        newTab?: boolean;
    }>;
};

type AnnouncementPopupProps = {
    announcement: AnnouncementContent;
    isOpen?: boolean;
    onClose?: () => void;
    showDismiss?: boolean;
};

export function AnnouncementPopup({
    announcement,
    isOpen = true,
    onClose,
    showDismiss = true,
}: AnnouncementPopupProps) {
    if (!isOpen) {
        return null;
    }

    const buttons = announcement.buttons ?? [];

    return (
        <aside
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
            aria-live="polite"
            aria-label="Announcement"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl rounded-3xl border border-slate-700/80 bg-slate-900/95 p-6 text-slate-100 shadow-2xl shadow-slate-950/80 sm:p-8"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-tight text-sky-300 sm:text-2xl">
                        {announcement.title}
                    </h2>
                    {showDismiss ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-slate-400 transition hover:bg-slate-800/70 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            aria-label="Close announcement"
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    ) : null}
                </div>

                <p className="mt-4 text-base leading-relaxed text-slate-200">{announcement.description}</p>

                {buttons.length > 0 ? (
                    <div className="mt-6 flex flex-wrap gap-3">
                        {buttons.map((button) => (
                            <a
                                key={`${button.text}-${button.url}`}
                                href={button.url}
                                className="inline-flex items-center rounded-md bg-sky-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
                                target={button.newTab ? '_blank' : undefined}
                                rel={button.newTab ? 'noopener noreferrer' : undefined}
                                onClick={() => onClose?.()}
                            >
                                {button.text}
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>
        </aside>
    );
}