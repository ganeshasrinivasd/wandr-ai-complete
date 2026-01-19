'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, differenceInDays, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface DateRangePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
}

export default function DateRangePicker({
    value,
    onChange,
    placeholder = 'Select your travel dates',
    required = false,
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [range, setRange] = useState<DateRange | undefined>();
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse existing value if present
    useEffect(() => {
        if (value && !range) {
            // Try to parse the value - this is a simple implementation
            // Could be enhanced with more robust date parsing
        }
    }, [value, range]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (newRange: DateRange | undefined) => {
        setRange(newRange);

        if (newRange?.from && newRange?.to) {
            const formattedRange = `${format(newRange.from, 'MMMM d')}-${format(newRange.to, 'd, yyyy')}`;
            onChange(formattedRange);
        } else if (newRange?.from) {
            onChange(format(newRange.from, 'MMMM d, yyyy'));
        }
    };

    const tripDuration = range?.from && range?.to
        ? differenceInDays(range.to, range.from) + 1
        : 0;

    // Dynamic instructional text
    const getInstructionText = () => {
        if (range?.from && !range?.to) return 'Select your return date';
        if (range?.from && range?.to) return `${format(range.from, 'MMM d')} - ${format(range.to, 'MMM d, yyyy')}`;
        return placeholder;
    };

    const displayText = getInstructionText();

    // Disable past dates
    const disabledDays = { before: new Date() };

    return (
        <div ref={containerRef} className="relative font-serif">
            {/* Input Field - Paper Card Style */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-5 py-4 bg-paper-card border rounded-sm cursor-pointer transition-all flex items-center gap-3 ${isOpen
                    ? 'border-leather ring-1 ring-leather shadow-md'
                    : 'border-ink/10 hover:border-leather/40 hover:shadow-sm'
                    }`}
            >
                <Calendar className={`w-5 h-5 ${range?.from ? 'text-leather' : 'text-ink/40'}`} />
                <div className="flex flex-col">
                    <span className={`font-typewriter ${range?.from ? 'text-ink font-medium' : 'text-ink/40'}`}>
                        {displayText}
                    </span>
                    {range?.from && !range?.to && (
                        <span className="text-[12px] text-stamp font-hand font-bold tracking-widest mt-0.5 -rotate-2">
                            SELECT END DATE
                        </span>
                    )}
                </div>
                {tripDuration > 0 && (
                    <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="ml-auto bg-paper-dark px-2 py-1 rounded-sm text-xs font-typewriter text-ink/70 border border-ink/5"
                    >
                        {tripDuration} days
                    </motion.span>
                )}
            </div>

            {/* Calendar Popover - Paper Style */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, rotateX: -5 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 mt-2 p-4 bg-paper-card border border-ink/10 rounded-sm shadow-xl z-50 w-full sm:w-auto overflow-hidden"
                    >
                        {/* Paper texture overlay */}
                        <div className="absolute inset-0 bg-paper-texture opacity-30 pointer-events-none mix-blend-multiply" />

                        <div className="relative z-10">
                            <DayPicker
                                mode="range"
                                defaultMonth={new Date()}
                                selected={range}
                                onSelect={handleSelect}
                                disabled={disabledDays}
                                numberOfMonths={1}
                                showOutsideDays
                                classNames={{
                                    months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 relative z-10',
                                    month: 'space-y-4',
                                    caption: 'flex justify-center pt-1 relative items-center mb-4',
                                    caption_label: 'text-lg font-serif font-bold text-ink italic',
                                    nav: 'space-x-1 flex items-center',
                                    nav_button: 'h-7 w-7 bg-paper-dark hover:bg-leather hover:text-white rounded-full flex items-center justify-center text-ink/60 transition-all border border-ink/5',
                                    nav_button_previous: 'absolute left-1',
                                    nav_button_next: 'absolute right-1',
                                    table: 'w-full border-collapse space-y-1',
                                    head_row: 'flex',
                                    head_cell: 'text-ink/40 rounded-md w-9 font-typewriter text-[0.7rem] uppercase tracking-wider',
                                    row: 'flex w-full mt-2',
                                    cell: 'text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent first:[&:has([aria-selected])]:rounded-l-sm last:[&:has([aria-selected])]:rounded-r-sm focus-within:relative focus-within:z-20',
                                    day: 'h-9 w-9 p-0 font-typewriter text-ink/80 hover:bg-paper-dark rounded-sm transition-all',
                                    day_range_start: 'day-range-start',
                                    day_range_end: 'day-range-end',
                                    day_selected: 'bg-leather text-paper hover:bg-leather/90 rounded-sm shadow-sm',
                                    day_today: 'text-stamp font-bold decoration-stamp underline underline-offset-4',
                                    day_outside: 'text-ink/20 opacity-50',
                                    day_disabled: 'text-ink/10 line-through opacity-30',
                                    day_range_middle: 'aria-selected:bg-leather/10 aria-selected:text-leather rounded-none',
                                    day_hidden: 'invisible',
                                }}
                            />

                            {/* Quick Select Options */}
                            <div className="mt-4 pt-4 border-t border-ink/10">
                                <p className="text-xs text-ink/40 mb-2 font-typewriter uppercase tracking-wider">Quick select</p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { label: 'Weekend', days: 3 },
                                        { label: '1 Week', days: 7 },
                                        { label: '2 Weeks', days: 14 },
                                    ].map((option) => (
                                        <button
                                            key={option.label}
                                            type="button"
                                            onClick={() => {
                                                const from = new Date();
                                                const to = addDays(from, option.days - 1);
                                                handleSelect({ from, to });
                                            }}
                                            className="px-3 py-1.5 text-xs bg-paper-dark hover:bg-ink/5 text-ink/70 hover:text-ink rounded-sm transition-all border border-ink/10 font-typewriter"
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Confirm Button */}
                            {range?.from && range?.to && (
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="w-full mt-4 py-3 bg-leather hover:bg-leather-light text-paper rounded-sm transition-all font-serif font-bold text-sm shadow-sm flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Confirm Trip
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
