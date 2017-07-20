import Clipboard from 'clipboard';
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import mousetrap from 'mousetrap';
import {
  curry,
  filter,
  flow,
  get,
  intersection,
  isEmpty,
  isEqual,
  join,
  last,
  map,
  split,
  uniqueId,
  reject,
} from 'lodash/fp';

import SimpleTag from './SimpleTag';

const KEYBOARD_SHORTCUTS = ['enter', 'esc', 'backspace', 'mod+a', 'mod+v'];

export const tagShape = PropTypes.shape({
  value: PropTypes.string.isRequired,

  // Special marks the tag as different. For example a special tag when using
  // the case-sensitive options is a case-sensitive tag
  special: PropTypes.bool,
});

const propTypes = {
  // Characters not allowed in the tags, defaults to `[',']` and must always
  // contain `,`
  blacklistChars: PropTypes.arrayOf(PropTypes.string),

  // Renders a copy to clipboard button
  copyButton: PropTypes.bool,

  // Label for the copy to clipboard button
  copyButtonLabel: PropTypes.string,

  // Error message rendered below the field. When the field is set it will
  // also has the class `is-error`
  error: PropTypes.string,

  // Rendered above the field itself
  label: PropTypes.string,

  placeholder: PropTypes.string,

  // Array of tags to display
  tags: PropTypes.arrayOf(tagShape),

  // Returns a custom way to render the tag
  tagRenderer: PropTypes.func,

  // Enable the creation of special tags
  specialTags: PropTypes.bool,

  // Returns a custom way to render the special button
  specialButtonRenderer: PropTypes.func,

  // Label for the special button.
  // Only used when a `specialButtonRenderer` is not defined.
  specialButtonLabel: PropTypes.string,

  // Fired when changing the tags with the `tags` array as the argument
  onChange: PropTypes.func.isRequired,

  // Same as the standard React SyntheticEvent
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,

  // Fired when the user interaction is considered complete, invoked with `tags`
  onSubmit: PropTypes.func,
};

const tagRenderer = ({ value, special }, onClick) => (
  <SimpleTag onClick={onClick} value={value} special={special} />
);

const defaultProps = {
  blacklistChars: [','],
  copyButton: false,
  copyButtonLabel: 'Copy to clipboard',
  specialButtonLabel: 'Special',
  specialTags: false,
  tags: [],
  tagRenderer,
  onBlur: () => {},
  onChange: () => {},
  onFocus: () => {},
  onSubmit: () => {},
};

export const parseTags = map(t => ({ ...t, __id: uniqueId('tag') }));
export const stripIds = map(t => ({ ...t, __id: undefined }));

export const getPlainTextTags = flow(
  map(get('value')),
  join(','),
);

export const hasBlacklistedChars = curry((blacklist, str) => flow(
  split(''),
  intersection(blacklist),
  i => !isEmpty(i),
)(str));

export const parseValuesWith = curry((blacklist, str) => flow(
  split(','),
  map((value) => {
    if (hasBlacklistedChars(blacklist, value)) return false;
    return { value };
  }),
  reject(isEmpty)
)(str));

class TagsInput extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      tags: parseTags(props.tags),

      // Value is what the user is typing in the input
      value: '',

      // When in focus
      isFocused: false,

      // When in selection mode renders a texarea containing comma-separated
      // list of tag values
      isSelectMode: false,

      // Paste mode is used for handling when the user pastes content
      isPasteMode: false,

      // When true the created tags will be marked as special
      isSpecial: false,

      // ID internally assigned to the input. You don't want to change this
      id: uniqueId('TagsInput_'),
    };

    // Input events
    this.handleBlurInput = this.handleBlurInput.bind(this);
    this.handleFocusInput = this.handleFocusInput.bind(this);
    this.handleChangeInput = this.handleChangeInput.bind(this);
    this.handleClickFauxInput = this.handleClickFauxInput.bind(this);
    this.handleShortcut = this.handleShortcut.bind(this);

    // Textarea for copy/paste
    this.handleBlurTextarea = this.handleBlurTextarea.bind(this);
    this.handleFocusTextarea = this.handleFocusTextarea.bind(this);

    // Other events
    this.handleClickTagButton = this.handleClickTagButton.bind(this);
    this.handleClickSpecial = this.handleClickSpecial.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (!isEqual(this.props.tags, nextProps.tags)) {
      this.setState({
        tags: parseTags(nextProps.tags),
        value: '',
        isPasteMode: false,
      });
    }
  }

  componentWillUpdate(nextProps, nextState) {
    // When the state is in pasteMode and we have a value, parse the value
    // and reset it
    if (nextState.isPasteMode && nextState.value) {
      const parseValue = parseValuesWith(this.props.blacklistChars);
      const tags = [...nextProps.tags, ...parseValue(nextState.value)];

      // We can't change the state here, rely on the onChange event to reset
      // the state.
      //
      // It works a folows:
      //   1. onChange is fired with new tags
      //   2. The element using this component will pass down the new tags
      //   3. In the componentWillReceiveProps lyfecycle the value is reset
      nextProps.onChange(tags);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // When going from select mode to normal, focus again on the input.
    // This must live in the didUpdate lyfecycle because the filed needs to be
    // already renderered with the correct params.
    if (prevState.isSelectMode && !this.state.isSelectMode) {
      this.input.focus();
    }
  }

  handleFocusInput() {
    // Ignore the event in selectMode
    if (this.state.isSelectMode) return;

    this.setState({ isFocused: true });
    this.props.onFocus();
    this.attachListeners();
  }

  handleBlurInput() {
    // Ignore the blur event in selectMode
    if (this.state.isSelectMode) return;

    this.setState({ isFocused: false });
    this.props.onBlur();
    this.removeListeners();
  }

  handleChangeInput(event) {
    const value = event.target.value;
    const lastChar = last(value);

    // If the value ends with a comma and it's not just a comma create a new
    // tag.
    // The order is imorant, this conditions goes before the blacklisting
    if (value.length > 1 && lastChar === ',') {
      return this.createTag();
    }

    // Ignore leading white spaces
    if (value.length === 1 && value === ' ') return null;

    if (this.props.blacklistChars.includes(lastChar)) return null;

    return this.setState({ value });
  }

  handleClickFauxInput(event) {
    if (this.state.isFocused) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    this.input.focus();
  }

  handleFocusTextarea() {
    mousetrap.bind('mod+c', () => this.handleShortcut('mod+c'));
  }

  handleBlurTextarea() {
    this.setState({ isSelectMode: false });
    mousetrap.unbind('mod+c');
  }

  /**
   * Fire a change event without the passed tag
   */
  handleClickTagButton(id) {
    const tags = flow(
      filter(t => t.__id !== id),
      stripIds,
    )(this.state.tags);

    this.props.onChange(tags);
  }

  /**
   * Toggle the special state
   */
  handleClickSpecial() {
    this.setState(state => ({
      isSpecial: !state.isSpecial,
    }));
  }

  handleShortcut(type) {
    switch (type) {

      // Create a new tag
      case 'enter': {
        // Whe the user press enter and there is no text currently being
        // wrtitten, fire the onSubmit event
        if (!this.state.value.length) return this.submitTags();

        return this.createTag();
      }

      case 'esc': {
        // Reset the input value when pressing esc if we have a value
        if (this.state.value) return this.setState({ value: '' });

        return this.input.blur();
      }

      // When the value of the input is empty and the user presses backspace,
      // delete the previous tag
      case 'backspace': {
        if (this.state.value.length || !this.props.tags.length) return null;

        // Remove the last tag in the array (in an immutable way)
        const tags = [...this.props.tags];
        tags.pop();

        return this.props.onChange(tags);
      }

      // Select the content of the plaintext field
      case 'mod+a': {
        // Ignore the event if the user is typing
        if (this.state.value.length) return null;

        return this.setState({ isSelectMode: true });
      }

      // The user copied to the clipboard, so reset the selcted state
      case 'mod+c':
        return window.setTimeout(() => this.setState({ isSelectMode: false }), 100);

      // When pasting, we'll receive the data in the next state update
      case 'mod+v':
        return this.setState({ isPasteMode: true });

      default:
        return null;

    }
  }

  /**
   * Listen for keys and key combinations
   */
  attachListeners() {
    KEYBOARD_SHORTCUTS.forEach(key => (
      mousetrap.bind(key, () => this.handleShortcut(key))
    ));
  }

  /**
   * Remove all the document listeners
   */
  removeListeners() {
    KEYBOARD_SHORTCUTS.forEach(key => mousetrap.unbind(key));
  }

  /**
   * Create a tag from the current state value
   */
  createTag() {
    const tags = [
      ...this.state.tags,
      {
        value: this.state.value,
        special: this.state.isSpecial,
      },
    ];
    this.props.onChange(tags);
  }

  submitTags() {
    const tags = stripIds(this.state.tags);
    this.props.onSubmit(tags);
  }

  textareaRef(el) {
    if (!el) return;

    // Focus on the textarea
    el.focus();
  }

  copyButtonRef(el) {
    if (!el) return;

    if (this.clipboard) this.clipboard.destroy();

    this.clipboard = new Clipboard(el, {
      text: () => getPlainTextTags(this.state.tags),
    });
  }

  /**
   * The header block contains:
   *  - Label
   *  - Special button with tooltip
   */
  renderHeaderBlock() {
    const {
      label,
      specialTags,
      specialButtonLabel,
      error,
      specialButtonRenderer,
    } = this.props;

    // When neither label or special icon is specified, render nothing
    if (!label && !specialTags) return null;

    let labelBlock;
    let buttonBlock;

    if (label) {
      const labelClassName = classNames('TagsInput__label', {
        'is-error': error,
      });

      labelBlock = (
        <label className={labelClassName} htmlFor={this.state.id}>
          {label}
        </label>
      );
    }

    if (specialTags && specialButtonRenderer) {
      buttonBlock = specialButtonRenderer(this.state.isSpecial, this.handleClickSpecial);
    } else if (specialTags && specialButtonLabel) {
      const btnClassName = classNames('TagsInput__special-btn', {
        'is-active': this.state.isSpecial,
      });

      buttonBlock = (
        <button className={btnClassName} onClick={this.handleClickSpecial}>
          {specialButtonLabel}
        </button>
      );
    }

    return (
      <div className="TagsInput__header">
        {labelBlock}
        {buttonBlock}
      </div>
    );
  }

  /**
   * The footer block contains:
   *  - Copy button
   *  - Erorr message
   */
  renderFooterBlock() {
    const { copyButton, copyButtonLabel, error } = this.props;

    // Render nothing when neHither an error nor the button in required
    if (!copyButton && !error) return null;

    let buttonBlock;
    let errorBlock;

    if (copyButton) {
      buttonBlock = (
        <button className="TagsInput__copy-btn" ref={el => this.copyButtonRef(el)}>
          {copyButtonLabel}
        </button>
      );
    }

    if (error) {
      errorBlock = (
        <span className="TagsInput__error">
          {error}
        </span>
      );
    }

    return (
      <div className="TagsInput__footer">
        {errorBlock}
        {buttonBlock}
      </div>
    );
  }

  renderActiveTags() {
    const { tagRenderer } = this.props;

    return this.state.tags.map(tag => (
      <div className="TagsInput__tag" key={tag.__id}>
        {tagRenderer(tag, () => this.handleClickTagButton(tag.__id))}
      </div>
    ));
  }

  render() {
    const { error, placeholder } = this.props;

    const headerBlock = this.renderHeaderBlock();
    const footerBlock = this.renderFooterBlock();

    const inputRef = (el) => { this.input = el; };
    const inputWidth = `${this.state.value.length + 1}ch`;
    const inputClassName = classNames('TagsInput__input', {
      'is-focused': this.state.isFocused || this.state.isSelectMode,
      'is-selected': this.state.isSelectMode,
      'is-error': error,
    });

    let activeTags;

    // In selectMode render a texarea whith the content already pre-selected.
    // Why a texarea? Beacause it can wrap to the next line, an input can't
    if (this.state.isSelectMode) {
      activeTags = (
        <textarea
          className="TagsInput__textarea mousetrap"
          value={getPlainTextTags(this.state.tags)}
          ref={el => this.textareaRef(el)}
          onFocus={this.handleFocusTextarea}
          onBlur={this.handleBlurTextarea}
          readOnly
        />
      );
    } else {
      activeTags = this.renderActiveTags();
    }

    let placeholderBlock;
    if (placeholder && !this.state.value && !this.state.tags.length) {
      placeholderBlock = (
        <span className="TagsInput__placeholder">
          {placeholder}
        </span>
      );
    }

    return (
      <div className="TagsInput">
        {headerBlock}

        <div className="TagsInput__field">
          {/* eslint-disable jsx-a11y/no-statielement-interactions */}
          <div
            className={inputClassName}
            onClick={this.handleClickFauxInput}
          >
            {/* eslint-enable jsx-a11y/no-statielement-interactions */}
            {activeTags}
            {placeholderBlock}

            <input
              type="text"
              id={this.state.id}
              style={{ width: inputWidth }}
              className="TagsInput__text mousetrap"
              value={this.state.value}
              ref={inputRef}
              onChange={this.handleChangeInput}
              onBlur={this.handleBlurInput}
              onFocus={this.handleFocusInput}
            />
          </div>
        </div>

        {footerBlock}

      </div>
    );
  }

}

TagsInput.propTypes = propTypes;
TagsInput.defaultProps = defaultProps;

export default TagsInput;
