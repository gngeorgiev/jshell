const { expandPath } = require('./shellUtils');
const constants = require('./constants');
const _ = require('lodash');

const commandOperations = _
    .chain(constants.CommandOperation)
    .values()
    .without(constants.CommandOperation.None)
    .value();

class Parser {
    constructor(shell) {
        this.shell = shell;
    }

    _getCommandTokens(command) {
        const commandTokens = [];

        let matchedIndex = 0;
        let openningQuote = null;
        const pushToken = (index) => {
            commandTokens.push(command.substring(matchedIndex, index + 1));
            matchedIndex = index + 1;
        };

        command.split('').forEach((char, index) => {
            if (char === ' ' && openningQuote === null || index === command.length - 1) {
                return pushToken(index);
            }

            if (char === '"' || char === "'") {
                if (openningQuote === char) {
                    openningQuote = null;
                    return pushToken(index);
                } else {
                    openningQuote = char;
                }
            }
        });

        return commandTokens;
    }

    _buildCommand(command, operation, commands) {
        const shell = this.shell;
        const commandTokens = this._getCommandTokens(command);

        return {
            cmdFull: command,
            operation: operation || constants.CommandOperation.None,
            index: commands.length,
            value: null,
            exitCode: null,
            get cmd() {
                return commandTokens[0].trim();
            },
            get args() {
                return commandTokens.slice(1).map(arg => arg.trim()).map(arg => expandPath(arg, shell));
            },
            get next() {
                return commands[this.index + 1];
            },
            get previous() {
                return commands[this.index - 1];
            }
        };
    }

    _parseLine(line) {
        const lineChars = line.split('');
        const commands = [];

        let lastMatchIndex = 0;
        lineChars.forEach((char, index) => {
            const isLast = index === line.length - 1;
            const isOperation = commandOperations.includes(char);

            if (char === constants.CommandOperation.Background && lineChars[index + 1] === constants.CommandOperation.Background) {
                return;
            }

            if (char === constants.CommandOperation.Background && lineChars[index - 1] === constants.CommandOperation.Background) {
                char = constants.CommandOperation.And
            }

            if (isOperation || isLast) {
                let matchingIndex = isLast ? undefined : index;
                if (char === constants.CommandOperation.And) {
                    matchingIndex--;
                }

                const cmdString = lineChars.slice(lastMatchIndex, matchingIndex).join('').trim();
                const operation = isOperation ? char : constants.CommandOperation.None;
                const cmd = this._buildCommand(cmdString, operation, commands);

                commands.push(cmd);
                lastMatchIndex = matchingIndex + char.length;
            }
        });

        return commands;
    }

    parse(line) {
        return {
            commands: this._parseLine(line)
        }
    }
}

module.exports = Parser;
