const assert = require('assert');
const { Filter } = require('../src');

describe('filter', () => {
  it('compares correctly', async () => {
    assert(new Filter().isSame(new Filter()));
    assert(new Filter(null).isSame(new Filter()));
    assert(new Filter().isSame(new Filter(null)));
    assert(new Filter({a: 1}).isSame(new Filter({a: 1})));
    assert(new Filter({a: 1, b: 1}).isSame(new Filter({a: 1, b: 1})));
    assert(new Filter({a: 1, b: 1}).isSame(new Filter({b: 1, a: 1})));
    assert(!new Filter({a: 1}).isSame(new Filter(null)));
    assert(!new Filter(null).isSame(new Filter({a: 1})));
    assert(!new Filter({a: 1}).isSame(new Filter({b: 1})));
    assert(!new Filter({a: 1}).isSame(new Filter({a: 1, b: 1})));
    assert(!new Filter({a: 1, b: 1}).isSame(new Filter({a: 2, b: 1})));
    assert(!new Filter({a: 0}).isSame(new Filter({a: null})));
  });
});
