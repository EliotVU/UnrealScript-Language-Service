({
    parensLevel: 0,
    braceLevel: 0,
    evaluateLexerPredicate: (lexer, ruleIndex, actionIndex, predicate) => eval(predicate),
    evaluateParserPredicate: (parser, ruleIndex, actionIndex, predicate) => eval(predicate)
});
