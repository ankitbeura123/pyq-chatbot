import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './CustomSelect.css';

export default function CustomSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select option…',
  disabled = false,
  className = '',
  style = {},
  dropdownStyle = {},
  size = 'md',
  icon = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options to [{ value, label, disabled }]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : '',
        label: opt.label || opt.name || String(opt.value),
        disabled: !!opt.disabled,
      };
    }
    return { value: opt, label: String(opt), disabled: false };
  });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));
  const displayText = selectedOption && selectedOption.value !== '' ? selectedOption.label : placeholder;
  const hasValue = selectedOption && selectedOption.value !== '';

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (opt) => {
    if (opt.disabled) return;
    if (onChange) {
      onChange(opt.value);
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-container custom-select-${size} ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''} ${className}`}
      style={style}
    >
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${!hasValue ? 'is-placeholder' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-select-label-wrap">
          {icon && <span className="custom-select-icon">{icon}</span>}
          <span className="custom-select-text">{displayText}</span>
        </span>
        <ChevronDown
          size={size === 'sm' ? 13 : 15}
          className={`custom-select-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="custom-select-dropdown"
          style={dropdownStyle}
          role="listbox"
        >
          <div className="custom-select-options-scroll">
            {normalizedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={`${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option ${isSelected ? 'selected' : ''} ${opt.disabled ? 'disabled-option' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  <span className="custom-select-option-label">{opt.label}</span>
                  {isSelected && <Check size={14} className="custom-select-check-icon" />}
                </div>
              );
            })}
            {normalizedOptions.length === 0 && (
              <div className="custom-select-empty">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
