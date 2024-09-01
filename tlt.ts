#!/usr/bin/env ts-node

const { execSync, spawn } = require('child_process');

function exec(cmd: string) {
  return execSync(cmd, { maxBuffer: 1024 * 1024 * 10 }).toString().trim();
}

function run(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: 'inherit' });

  child.on('error', (error: { message: string }) => {
    console.error(`Error: ${error.message}`);
  });

  child.on('exit', (code: number) => {
    console.log(`Process exited with code ${code}`);
  });
}

const { Command } = require("commander");
const program = new Command();

program
  .name("blog")
  .description("Manage blog posts")
  .version("1.0.0");

function findFile(title: string) {
  const existingFile = exec(`
    cd ~/tlt/thelackthereof/content
    ls *.md | rg '${title}' || true
  `);
  if (existingFile.match(/\n/)) {
    console.log(`Found too many matches:\n${existingFile}`);
    throw "Error: Too many matches";
  }
  return existingFile;
}

program.command('new')
  .alias('edit')
  .description('Create or edit a blog post')
  .argument('<title...>', 'blog post title')
  .action((titleList: string[]) => {
    const title = titleList.join(' ');

    // Run the external command and store the output in a variable
    const existingFile = findFile(title);

    if (existingFile) {
      run('vim', [`/home/awwaiid/tlt/thelackthereof/content/${existingFile}`]);
    } else {
      const fileDate = exec("date '+%Y.%m.%d'");
      const templateDate = exec("date '+%Y-%m-%d'");
      let newFilename = `TLT - ${fileDate} - ${title}.md`;

      console.log(`Create/Edit blog '${newFilename}'`);

      exec(`
        cd ~/tlt/thelackthereof/content
        cp -n "Blog Template TLT - 2023.01.01 - Blog Template.md" "${newFilename}"
        perl -pi -e "s/TEMPLATE_TITLE/${title}/" "${newFilename}"
        perl -pi -e "s/TEMPLATE_DATE/${templateDate}/" "${newFilename}"
      `);
      run('vim', [`/home/awwaiid/tlt/thelackthereof/content/${newFilename}`]);
    }
  });

program.command('drafts')
  .description('List draft posts')
  .action(() => {
    console.log(exec(`
      cd ~/tlt/thelackthereof/content
      rg -l 'draft: true' TLT*.md | sort
    `));
  });

program.command('list')
  .description('List posts')
  .action(() => {
    console.log(exec(`
      cd ~/tlt/thelackthereof/content
      ls TLT*.md
    `));
  });

program.command('publish')
  .description("Update an entry to be published with today's date")
  .argument('<title...>', 'blog post title')
  .action((titleList: string[]) => {
    const title = titleList.join(' ');

    const existingFile = findFile(title);

    if (existingFile) {
      exec(`
        cd ~/tlt/thelackthereof/content
        perl -pi -e 's/draft: true//' "${existingFile}"
      `);
    } else {
      console.log("File not found");
    }
  });

program.command('push')
  .description("Push blog updates to server")
  .action(() => {
    console.log("Building and syncing...");
    console.log(exec(`
      cd ~/tlt/thelackthereof
      npm run deploy || true
    `));
  });

program.parse(process.argv);
// const options = program.opts();
