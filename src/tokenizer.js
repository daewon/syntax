/**
 * The MIT License (MIT)
 * Copyright (c) 2015-present Dmitry Soshnikov <dmitry.soshnikov@gmail.com>
 */

import GrammarSymbol from './grammar/grammar-symbol';
import {EOF} from './special-symbols';

const EOF_TOKEN = {
  type: EOF,
  value: EOF,
};

/**
 * A simple tokenizer that extracts tokens from the string,
 * based on the tokens from the grammar.
 *
 * We don't implement raw NFA/DFA here, rather use underlying
 * regexp implementaiton, however the tokenizer can easily be
 * replaced with any other custom implementation when is passed
 * to the parser.
 */
export default class Tokenizer {

  /**
   * Creates a tokenizer instance for a string
   * that belongs to the given grammar.
   */
  constructor({string, grammar}) {
    this._grammar = grammar;

    /**
     * Tokenizer states to work with start conditions of lex rules.
     * The `INITIAL` state always present, i.e. all rules with no
     * explicit start conditions are executed, untill a new state is
     * pushed. If the state is exclusive, then only the rules with this
     * start condition are executed. If it's inclusive, then in addition
     * rules with no start conditions are executed as well.
     * https://gist.github.com/DmitrySoshnikov/f5e2583b37e8f758c789cea9dcdf238a
     */
    this._states = ['INITIAL'];

    if (string) {
      this.initString(string);
    }
  }

  /**
   * Returns tokenizer states.
   */
  getStates() {
    return this._states;
  }

  /**
   * Returns current state.
   */
  getCurrentState() {
    return this._states[this._states.length - 1];
  }

  /**
   * Pushes a new state for the tokinizer. Some lex-rules may
   * specify in which state they are triggered. A rule won't be
   * triggered if a tokenizer is not in this state.
   */
  pushState(state) {
    this._states.push(state);
  }

  /**
   * Alias for `pushState`.
   */
  begin(state) {
    this.pushState(state);
  }

  /**
   * Pops a state. If there is only INITIAL state, just returns it.
   */
  popState() {
    if (this._states.length > 1) {
      return this._states.pop();
    }
    return this._states[0];
  }

  initString(string) {
    this._string = string + EOF;
    this._cursor = 0;
  }

  getTokens() {
    if (!this._tokens) {
      // Rewind to calculate all tokens.
      let cursor = this._cursor;
      this._cursor = 0;
      this._tokens = [];
      while (this.hasMoreTokens()) {
        this._tokens.push(this.getNextToken());
      }
      // And restore back for the `getNextToken`.
      this._cursor = cursor;
    }
    return this._tokens;
  }

  /**
   * Returns next token.
   */
  getNextToken() {
    if (!this.hasMoreTokens()) {
      return EOF_TOKEN;
    } else if (this.isEOF()) {
      this._cursor++;
      return EOF_TOKEN;
    }

    // Analyze untokenized yet part of the string starting from
    // the current cursor position (so all regexp are from ^).
    let string = this._string.slice(this._cursor);

    // Get all rules which should be considered for this state.
    const lexRulesForState = this._grammar.getLexRulesForState(
      this.getCurrentState(),
    );

    for (let lexRule of lexRulesForState) {
      let matched = this._match(string, lexRule.getMatcher());
      if (matched) {
        let [yytext, rawToken] = lexRule.getTokenData(matched, this);

        // Usually whitespaces, etc.
        if (!rawToken) {
          return this.getNextToken();
        }

        let token = new GrammarSymbol(rawToken);

        return {
          type: token.getSymbol(),
          value: token.isTerminal()
            ? token.getSymbol()
            : yytext,
        };
      }
    }

    throw new Error(`Unexpected token: "${string[0]}".`);
  }

  isEOF() {
    return this._string[this._cursor] === EOF &&
      this._cursor === this._string.length - 1;
  }

  hasMoreTokens() {
    return this._cursor < this._string.length;
  }

  /**
   * Generic tokenizing based on current regexp.
   */
  _match(string, regexp) {
    let matched = string.match(regexp);
    if (matched) {
      this._cursor += matched[0].length;
      return matched[0];
    }
    return null;
  }
};
