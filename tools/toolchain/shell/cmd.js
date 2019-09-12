/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const spawn = require('child_process').spawn;

// A general purpose structure that can be used for any command.
// This defines the important 'spawn' command. This executes the command
// with the arguments that have been specified.
// It is set to inherit the environment variables, uses the default sell, and inherits the
// stdio/stderr streams. (Inheriting means that the formating colour, etc is maintained)
//
// spawn() MUST be the last item chained sequence
//
// It also blanks the arguments supplied, so the instance of the cmd can be reused
// It returns a promise that is resolved when the exit code is 0, and rejected for any other code
const _cmd = {
    cmd: '',
    args: [],
    stdoutstr: [],

    // can override the cwd
    spawn: function (cwd = process.cwd()) {
        const promise = new Promise((resolve, reject) => {
            const _name = this.toString();
            // eslint-disable-next-line no-console
            console.log(`spawning:: ${_name} in ${cwd}`);
            const call = spawn(this.cmd, this.args, {env: process.env, shell: true, stdio: ['inherit', 'pipe', 'inherit'], cwd});
            this.args = [];
            this.stdoutstr = [];
            call.on('exit', (code) => {
                // eslint-disable-next-line no-console
                console.log(`spawning:: ${_name} code::${code}`);
                if (code === 0) {
                    resolve(0);
                } else {
                    reject(code);
                }
            });
            call.stdout.on('data', (data) => {
                const s = data.toString('utf8');
                console.log(s.slice(0, s.length - 1));
                this.stdoutstr.push(s);
            });
            return call;
        });

        return promise;
    },
    toString: function () {
        return `${this.cmd} ${this.args.join(' ')}`;
    }
};


const newCmd = (newcmd) => {
    // duplicate the generic cmd object
    const _new = Object.create(_cmd);
    _new.cmd = newcmd;
    _new.args = [];
    return _new;
};

module.exports = _cmd;
module.exports.newCmd = newCmd;
module.exports.shell = async (cmds) => {
    const retvals = [];
    for (const c of cmds) {
        const cmd = newCmd(c);
        await cmd.spawn();
        retvals.push(cmd.stdoutstr.join(' '));
    }
    return retvals;

};