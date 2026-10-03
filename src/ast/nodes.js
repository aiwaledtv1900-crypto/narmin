'use strict';

const NodeType = {
  PROGRAM: 'Program',

  // التعابير
  NUMBER: 'NumberLiteral',
  STRING: 'StringLiteral',
  BOOLEAN: 'BooleanLiteral',
  NULL: 'NullLiteral',
  IDENTIFIER: 'Identifier',
  BINARY: 'BinaryExpr',
  UNARY: 'UnaryExpr',
  CALL: 'CallExpr',
  MEMBER: 'MemberExpr',
  INDEX: 'IndexExpr',
  PIPE: 'PipeExpr',
  ARRAY: 'ArrayLiteral',
  OBJECT: 'ObjectLiteral',
  ASSIGN_EXPR: 'AssignExpr',
  IF_EXPR: 'IfExpr',

  // الجمل
  PRINT: 'PrintStmt',
  EXPR_STMT: 'ExprStmt',
  LET: 'LetStmt',
  CONST: 'ConstStmt',
  ASSIGN: 'AssignStmt',
  IF: 'IfStmt',
  WHILE: 'WhileStmt',
  FOR: 'ForStmt',
  FUNCTION: 'FunctionDecl',
  RETURN: 'ReturnStmt',
  BREAK: 'BreakStmt',
  CONTINUE: 'ContinueStmt',
  IMPORT: 'ImportStmt',
  BLOCK: 'Block',
};

const AST = {
  Program: (body) => ({ type: NodeType.PROGRAM, body }),

  Number: (value) => ({ type: NodeType.NUMBER, value }),
  String: (value) => ({ type: NodeType.STRING, value }),
  Boolean: (value) => ({ type: NodeType.BOOLEAN, value }),
  Null: () => ({ type: NodeType.NULL }),
  Identifier: (name) => ({ type: NodeType.IDENTIFIER, name }),

  Binary: (op, left, right) => ({ type: NodeType.BINARY, op, left, right }),
  Unary: (op, arg, prefix = true) => ({ type: NodeType.UNARY, op, arg, prefix }),
  Call: (callee, args) => ({ type: NodeType.CALL, callee, args }),
  Member: (obj, prop) => ({ type: NodeType.MEMBER, object: obj, property: prop }),
  Index: (obj, index) => ({ type: NodeType.INDEX, object: obj, index }),
  Pipe: (left, right) => ({ type: NodeType.PIPE, left, right }),
  Array: (elements) => ({ type: NodeType.ARRAY, elements }),
  Object: (properties) => ({ type: NodeType.OBJECT, properties }),
  AssignExpr: (target, value) => ({ type: NodeType.ASSIGN_EXPR, target, value }),
  IfExpr: (test, consequent, alternate) => ({ type: NodeType.IF_EXPR, test, consequent, alternate }),

  Print: (arg) => ({ type: NodeType.PRINT, arg }),
  ExprStmt: (expr) => ({ type: NodeType.EXPR_STMT, expr }),
  Let: (name, init, mutable) => ({ type: NodeType.LET, name, init, mutable }),
  Const: (name, init) => ({ type: NodeType.CONST, name, init }),
  Assign: (target, value) => ({ type: NodeType.ASSIGN, target, value }),
  If: (test, consequent, alternate) => ({ type: NodeType.IF, test, consequent, alternate }),
  While: (test, body) => ({ type: NodeType.WHILE, test, body }),
  For: (variable, iterable, body) => ({ type: NodeType.FOR, variable, iterable, body }),
  Function: (name, params, body) => ({ type: NodeType.FUNCTION, name, params, body }),
  Return: (arg) => ({ type: NodeType.RETURN, arg }),
  Break: () => ({ type: NodeType.BREAK }),
  Continue: () => ({ type: NodeType.CONTINUE }),
  Import: (names, from, alias) => ({ type: NodeType.IMPORT, names, from, alias }),
  Block: (body) => ({ type: NodeType.BLOCK, body }),
};

module.exports = { NodeType, AST };
