import React from 'react';

import TagsInput from '../../lib/TagsInput';
import './TagsInput.css';
import './SimpleTag.css';
import './Demo.css';

export default class Demo extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      basic: [],
      full: [],
    };
  }

  render() {
    return (
      <div className="Wrapper">
        <h1>Simple example</h1>
        <TagsInput
          label="Tags"
          placeholder="Write tags"
          tags={this.state.basic}
          onChange={tags => this.setState({ basic: tags })}
        />

        <h1>Complete example</h1>
        <TagsInput
          label="Tags"
          placeholder="Write tags"
          tags={this.state.full}
          onChange={tags => this.setState({ full: tags })}
          specialTags
          copyButton
        />
      </div>
    );
  }
}
