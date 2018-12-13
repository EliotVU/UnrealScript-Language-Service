import { Token } from 'antlr4ts/Token';

export class DiagnosticNode {
	constructor(private token: Token) {

	}

	getToken(): Token {
		return this.token;
	}

	toString(): string {
		return this.token.toString();
	}
}

export class CodeErrorNode extends DiagnosticNode {
	constructor(token: Token, private errorText: string) {
		super(token);
	}

	toString(): string {
		return this.errorText;
	}
}
