import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const propTypes = {
  value: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

function SimpleTag({ onClick, value, special }) {
  const className = classNames('SimpleTag', {
    'is-special': special,
  });

  return (
    <span className={className}>
      {value}

      <button onClick={onClick} className="SimpleTag__btn">
        &times;
      </button>
    </span>
  );
}

SimpleTag.propTypes = propTypes;

export default SimpleTag;
