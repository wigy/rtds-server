/**
 * A description of a object filter.
 */
class Filter {
  constructor(expression = null) {
    this.expression = expression;
    // TODO: Should order keys alphabetically.
    if (expression === null) {
      this.name = 'null';
    } else if (expression instanceof Object) {
      // Sort keys.
      const keys = Object.keys(expression).sort();
      const name = keys.reduce((prev, cur) => ({...prev, [cur]: expression[cur]}), {});
      this.name = JSON.stringify(name);
    } else {
      throw new Error(`Invalid filter expression of type ${typeof expression}.`);
    }
  }

  /**
   * Check if this filter is the same than other filter.
   * @param {Filter} other
   */
  isSame(other) {
    return this.name === other.name;
  }

  toString() {
    return this.name;
  }
}

module.exports = Filter;
