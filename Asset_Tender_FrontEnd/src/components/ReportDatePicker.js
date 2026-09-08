import React from 'react';
import DatePicker from 'react-datepicker';
import { format, parseISO, isValid } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

const DEFAULT_MIN_DATE = new Date(2020, 0, 1);

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

const ReportDatePicker = ({
  id,
  label,
  value,
  onChange,
  minDate = DEFAULT_MIN_DATE,
  maxDate = new Date(),
  optionalLabelSuffix = '',
}) => {
  const selectedDate = parseIsoDate(value);

  const handleChange = (date) => {
    if (!date) {
      onChange('');
      return;
    }

    onChange(format(date, 'yyyy-MM-dd'));
  };

  return (
    <div className="ard-date-field">
      <label className="ard-field-label" htmlFor={id}>
        {label}
        {optionalLabelSuffix}
      </label>
      <DatePicker
        id={id}
        selected={selectedDate}
        onChange={handleChange}
        dateFormat="yyyy-MM-dd"
        minDate={minDate}
        maxDate={maxDate}
        showPopperArrow={false}
        placeholderText="yyyy-mm-dd"
        className="ard-date-input"
        calendarClassName="ard-datepicker-calendar"
        popperClassName="ard-datepicker-popper"
        isClearable
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
      />
    </div>
  );
};

export default ReportDatePicker;
