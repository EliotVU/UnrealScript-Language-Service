import { ANTLRInputStream, CommonTokenStream, Token } from 'antlr4ts';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';
import { ParseTreeListener } from 'antlr4ts/tree/ParseTreeListener';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';

import { UCGrammarListener } from './antlr/UCGrammarListener';
import { UCGrammarLexer } from './antlr/UCGrammarLexer';
import * as UCParser from './antlr/UCGrammarParser';
import { stringify } from 'querystring';

export class UCField {
	public nameToken: Token;
}

export class UCProperty extends UCField {
	public typeToken: Token;
}

export class UCStruct extends UCField {
	public extendsToken?: Token;
	public extends?: UCStruct;
	public fields: UCField[] = [];
}

export class UCDocument {
	public class: UCClass;
	private context: UCStruct[] = []; // FIXME: Type

	constructor(public uri: string) {
	}

	push(context: UCStruct) {
		this.context.push(context);
	}

	pop() {
		this.context.pop();
	}

	get(): UCStruct {
		return this.context.length > 0
			? this.context[this.context.length - 1]
			: this.class;
	}
}

export class UCFunction extends UCStruct {
	public returnTypeToken?: Token;
}

export class UCClass extends UCStruct {
}

class ScopeListener implements UCGrammarListener {
	public getDocument: (className: string) => UCDocument;

	constructor(private document: UCDocument) {

	}

	pushField(field: UCField) {
		console.log(this.document.uri, field.nameToken ? field.nameToken.text : '???');
		this.document.get().fields.push(field);
	}

	visitErrorNode(node: ErrorNode) {
		console.error(node.text);
	}

	enterClassDecl(ctx: UCParser.ClassDeclContext) {
		const parsedClass = new UCClass();
		this.document.class = parsedClass;
		parsedClass.nameToken = ctx.className().start;

		try {
			let extendsTree = ctx.classExtendsReference();
			if (extendsTree) {
				parsedClass.extendsToken = extendsTree.start;

				let extendsClassName = extendsTree.text;
				let extendsDocument = this.getDocument(extendsClassName);
				if (extendsDocument) {
					parsedClass.extends = extendsDocument.class;
				}
			}
		} catch(err) {
			console.log(err);
		}

		this.document.push(parsedClass);
	}

	enterStructDecl(ctx: UCParser.StructDeclContext) {
		const struct = new UCStruct();
		struct.nameToken = ctx.structName().start;

		let extendsTree = ctx.structReference();
		if (extendsTree) {
			struct.extendsToken = extendsTree.start;
		}

		this.document.push(struct);
	}

	exitStructDecl(ctx: UCParser.StructDeclContext) {
		this.document.pop();
	}

	enterConstDecl(ctx: UCParser.ConstDeclContext) {
		const constant = new UCField();
		constant.nameToken = ctx.constName().start;
		this.pushField(constant);
	}

	enterVarDecl(ctx: UCParser.VarDeclContext) {
		const propType = ctx.variableType();
		for (const varCtx of ctx.variable()) {
			let prop = new UCProperty();
			prop.typeToken = propType.start;
			let propName = varCtx.variableName().start;
			prop.nameToken = propName;
			this.pushField(prop);
		}
	}

	enterFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const parsedFunction = new UCFunction();
		let returnTypeTree = ctx.returnType();
		if (returnTypeTree) {
			parsedFunction.returnTypeToken = returnTypeTree.start;
		}
		let functionNameTree = ctx.functionName();
		if (functionNameTree) {
			parsedFunction.nameToken = functionNameTree.start;
		}
		this.pushField(parsedFunction);
	}
}

class CaseInsensitiveStream extends ANTLRInputStream {
	LA(i): number {
		var c = super.LA(i);
		if (c <= 0) {
			return c;
		}

		// return String.prototype.toLowerCase.call(String.fromCodePoint(c));
		if (c < 65 || c > 90) {
            return c;
		}
		return c + 32;
	}
}

export class ScopeParser {
	private listener: ScopeListener;
	private lexer: UCGrammarLexer;
	private parser: UCParser.UCGrammarParser;

	private document: UCDocument;

	constructor(uri: string, text: string) {
		console.log('Constructing parser for', uri);

		// FIXME: toLowerCase hack because my LA override is not working.
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));
		this.parser = new UCParser.UCGrammarParser(new CommonTokenStream(this.lexer));
		this.parser.buildParseTree = true;

		this.document = new UCDocument(uri);
		this.listener = new ScopeListener(this.document);
	}

	parse(getDocument: (className: string) => UCDocument): UCDocument {
		this.listener.getDocument = getDocument;

		try {
			let tree = this.parser.program();
			ParseTreeWalker.DEFAULT.walk(this.listener, tree);
		} catch(err) {
			console.log('something went wrong parsing a document!', err);
		}
		return this.document;
	}
};