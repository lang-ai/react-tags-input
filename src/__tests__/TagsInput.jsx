import React from 'react';
import renderer from 'react-test-renderer';

import {
  default as TagsInput,
  parseTags,
  stripIds,
  getPlainTextTags,
  hasBlacklistedChars,
  parseValuesWith,
} from '../TagsInput';

describe('TagsInput', () => {
  test('paserTags assigns ids to the tags', () => {
    const values = [{ value: 'foo' }, { value: 'bar', special: true }];
    const out = parseTags(values);

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(expect.objectContaining({ __id: expect.anything() }));
    expect(out[1]).toEqual(expect.objectContaining({ __id: expect.anything() }));
    expect(out[0].__id).not.toEqual(out[1].__id);
  });

  test('stripIds removes only the generated ids', () => {
    const values = [{ value: 'foo', __id: 1 }, { value: 'bar', custom: true, __id: 2 }];
    const out = stripIds(values);

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ value: 'foo' });
    expect(out[1]).toEqual({ value: 'bar', custom: true });
  });

  test('getPlainTextTags transform tags to plain text', () => {
    const values = [{ value: 'foo', __id: 1 }, { value: 'bar', special: true, __id: 2 }];
    const out = getPlainTextTags(values);
    const expected = 'foo,bar';

    expect(out).toEqual(expected);
  });

  test('hasBlacklistedChars catches a string with a blacklisted character', () => {
    const bl = [',', '+'];
    const hasBl = hasBlacklistedChars(bl);

    expect(hasBl('exa,ple')).toEqual(true);
    expect(hasBl('test+')).toEqual(true);
    expect(hasBl('clean')).toEqual(false);
  });

  test('hasBlacklistedChars catches a string with multiple blacklisted chars', () => {
    const bl = [',', '+'];
    const hasBl = hasBlacklistedChars(bl);

    expect(hasBl('exa,p+le')).toEqual(true);
    expect(hasBl('test+sda/3,2')).toEqual(true);
    expect(hasBl('clean')).toEqual(false);
  });

  describe('parseValuesWith', () => {
    test('parses a single value', () => {
      const parseVal = parseValuesWith([]);
      const out = parseVal('foo');

      expect(out).toHaveLength(1);
      expect(out[0]).toEqual({ value: 'foo' });
    });

    test('parses multiple values', () => {
      const parseVal = parseValuesWith([]);
      const out = parseVal('foo,bar');

      expect(out).toHaveLength(2);
      expect(out).toEqual([{ value: 'foo' }, { value: 'bar' }]);
    });

    test('ignores blacklisted values', () => {
      const parseVal = parseValuesWith(['+']);
      const out = parseVal('foo,bar,ev+il');

      expect(out).toHaveLength(2);
      expect(out).toEqual([{ value: 'foo' }, { value: 'bar' }]);
    });
  });

  // Snapshots {{{
  describe('snapshots', () => {
    test('renders a plain input', () => {
      let tree = renderer.create(<TagsInput />).toJSON();
      expect(tree).toMatchSnapshot();

      const tags = [{ value: 'foo' }];
      tree = renderer.create(<TagsInput tags={tags} />).toJSON();
      expect(tree).toMatchSnapshot();
    });

    test('renders with a complete component', () => {
      let tree = renderer.create((
        <TagsInput
          label="foo"
          placeholder="foo"
          copyButton
          specialTags
        />
      )).toJSON();
      expect(tree).toMatchSnapshot();
    });

    test('renders with a custom tag', () => {
      const tagRenderer = () => <span className="customTag" />;
      let tree = renderer.create((
        <TagsInput
          tagRenderer={tagRenderer}
          tags={[{ value: 'foo' }]}
        />
      )).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });
  // }}}
});
