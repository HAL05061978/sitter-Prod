'use client';

import React, { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isBefore,
  isAfter,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  isSameMonth
} from 'date-fns';
import { useTranslation } from 'react-i18next';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onConfirm: (startDate: string, endDate: string) => void;
  onCancel: () => void;
  isOpen: boolean;
  minDate?: Date;
}

const monthKeys = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const dayKeys = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];

export function DateRangePicker({
  startDate,
  endDate,
  onConfirm,
  onCancel,
  isOpen,
  minDate = new Date()
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation();

  // Initialize with provided dates or today
  const initialStart = startDate ? new Date(startDate + 'T00:00:00') : null;
  const initialEnd = endDate ? new Date(endDate + 'T00:00:00') : null;

  const [rangeStart, setRangeStart] = useState<Date | null>(initialStart);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(initialEnd);
  const [currentMonth, setCurrentMonth] = useState<Date>(initialStart || new Date());
  const [selectingEnd, setSelectingEnd] = useState(false);

  // Reset state when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      const newStart = startDate ? new Date(startDate + 'T00:00:00') : null;
      const newEnd = endDate ? new Date(endDate + 'T00:00:00') : null;
      setRangeStart(newStart);
      setRangeEnd(newEnd);
      setCurrentMonth(newStart || new Date());
      setSelectingEnd(false);
    }
  }, [isOpen, startDate, endDate]);

  if (!isOpen) return null;

  // Set minDate to start of today to allow selecting today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effectiveMinDate = minDate ? new Date(minDate) : today;
  effectiveMinDate.setHours(0, 0, 0, 0);

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart); // Start from Sunday
  const calendarEnd = endOfWeek(monthEnd); // End on Saturday

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleDayClick = (day: Date) => {
    // Don't allow selecting dates before minDate
    if (isBefore(day, effectiveMinDate)) return;

    if (!rangeStart || (rangeStart && rangeEnd)) {
      // Starting new selection
      setRangeStart(day);
      setRangeEnd(null);
      setSelectingEnd(true);
    } else if (selectingEnd) {
      // Selecting end date
      if (isBefore(day, rangeStart)) {
        // If clicked date is before start, swap them
        setRangeEnd(rangeStart);
        setRangeStart(day);
      } else {
        setRangeEnd(day);
      }
      setSelectingEnd(false);
    }
  };

  const handleConfirm = () => {
    if (rangeStart) {
      const startStr = format(rangeStart, 'yyyy-MM-dd');
      // If no end date selected, use start date (same-day care)
      const endStr = rangeEnd ? format(rangeEnd, 'yyyy-MM-dd') : startStr;
      onConfirm(startStr, endStr);
    }
  };

  const isInRange = (day: Date): boolean => {
    if (!rangeStart || !rangeEnd) return false;
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  };

  const isRangeStart = (day: Date): boolean => {
    return rangeStart ? isSameDay(day, rangeStart) : false;
  };

  const isRangeEnd = (day: Date): boolean => {
    return rangeEnd ? isSameDay(day, rangeEnd) : false;
  };

  const isDisabled = (day: Date): boolean => {
    return isBefore(day, effectiveMinDate);
  };

  const isCurrentMonth = (day: Date): boolean => {
    return isSameMonth(day, currentMonth);
  };

  // Get localized month name
  const getMonthName = (date: Date): string => {
    const monthIndex = date.getMonth();
    return t(monthKeys[monthIndex]);
  };

  // Get localized day abbreviation
  const getDayName = (index: number): string => {
    return t(dayKeys[index]);
  };

  // Format date for display
  const formatDisplayDate = (date: Date | null): string => {
    if (!date) return '--';
    const monthName = getMonthName(date);
    return `${monthName} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <div className="fixed left-0 right-0 flex items-center justify-center bg-black/50 p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
          <h3 className="text-lg font-semibold">{t('selectDates')}</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-blue-700 rounded-full transition-colors"
            aria-label={t('cancel')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label={t('previousMonth')}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-medium text-gray-800">
            {getMonthName(currentMonth)} {currentMonth.getFullYear()}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label={t('nextMonth')}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayKeys.map((key, index) => (
              <div key={key} className="text-center text-sm font-medium text-gray-500 py-2">
                {getDayName(index)}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const disabled = isDisabled(day);
              const inRange = isInRange(day);
              const isStart = isRangeStart(day);
              const isEnd = isRangeEnd(day);
              const inCurrentMonth = isCurrentMonth(day);

              let dayClasses = 'h-11 w-full flex items-center justify-center text-sm rounded-lg transition-colors ';

              if (disabled) {
                dayClasses += 'text-gray-300 cursor-not-allowed ';
              } else if (isStart || isEnd) {
                dayClasses += 'bg-blue-600 text-white font-semibold cursor-pointer ';
              } else if (inRange) {
                dayClasses += 'bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 ';
              } else if (!inCurrentMonth) {
                dayClasses += 'text-gray-300 cursor-pointer hover:bg-gray-100 ';
              } else {
                dayClasses += 'text-gray-700 cursor-pointer hover:bg-gray-100 ';
              }

              return (
                <button
                  key={index}
                  onClick={() => !disabled && handleDayClick(day)}
                  className={dayClasses}
                  disabled={disabled}
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selection Summary */}
        <div className="px-4 py-3 bg-gray-50 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('startDate')}</div>
              <div className="text-sm font-medium text-gray-800">
                {formatDisplayDate(rangeStart)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('endDate')}</div>
              <div className="text-sm font-medium text-gray-800">
                {formatDisplayDate(rangeEnd || rangeStart)}
              </div>
            </div>
          </div>
          {selectingEnd && rangeStart && !rangeEnd && (
            <div className="mt-2 text-sm text-blue-600">
              {t('selectEndDate')}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            type="button"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!rangeStart}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              rangeStart
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            type="button"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DateRangePicker;
