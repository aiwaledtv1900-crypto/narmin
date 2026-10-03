'use strict';

const { tokenize } = require('./lexer/lexer');
const { TokenType } = require('./lexer/token');
const { parse, Parser } = require('./parser/parser');
const { NodeType, AST } = require('./ast/nodes');
const { Interpreter, run } = require('./interpreter/interpreter');
const { Environment } = require('./interpreter/environment');
const { startRepl } = require('./repl');

module.exports = {
  tokenize, TokenType,
  parse, Parser,
  NodeType, AST,
  Interpreter, run,
  Environment,
  startRepl,
  version: '0.1.0',
};
