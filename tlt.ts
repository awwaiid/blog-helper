#!/usr/bin/env ts-node

const { execSync, spawn } = require('child_process');

function exec(cmd: string, stream: boolean = false) {
  if (stream) {
    return execSync(cmd, { stdio: 'inherit' });
  } else {
    return execSync(cmd, { maxBuffer: 1024 * 1024 * 10 }).toString().trim();
  }
}

function run(command: string, args: string[], onSuccess: Function = () => {}) {
  const child = spawn(command, args, { stdio: 'inherit' });

  child.on('error', (error: { message: string }) => {
    console.error(`Error: ${error.message}`);
  });

  child.on('exit', (code: number) => {
    console.log(`Process exited with code ${code}`);
    if(onSuccess) {
      onSuccess();
    }
  });
}

const { Command } = require("commander");
const program = new Command();

program
  .name("tlt")
  .description("Manage The Lack Thereof pages")
  .version("1.1.0");

function findFile(title: string) {
  const escapedTitle = title.replace(/\//g, '\\/');
  const existingFile = exec(`
    cd ~/tlt/thelackthereof/content
    ls *.md | rg -- '${escapedTitle}' || true
  `);
  if (existingFile.match(/\n/)) {
    console.log(`Found too many matches:\n${existingFile}`);
    throw "Error: Too many matches";
  }
  return existingFile;
}

program.command('new')
  .alias('edit')
  .description('Create or edit a page or blog post')
  .option('-b, --blog', 'Blog post')
  .option('-d, --date <date>', 'Date of the page creation (if not now)')
  .option('-t, --tags <tags>', 'Tags for the page')
  .argument('<title...>', 'page title')
  .action((titleList: string[], options: any) => {
    const baseTitle = titleList.join(' ');
    const fileTitle = baseTitle.replace(/\//g, '-');
    const title = baseTitle.replace(/\//g, '\\/');

    // Run the external command and store the output in a variable
    const existingFile = findFile(title);

    if (existingFile) {
      const templateDate = options.date || exec("date '+%Y-%m-%d'");
      run('vim', [`/home/awwaiid/tlt/thelackthereof/content/${existingFile}`], () => {
        exec(`
          cd ~/tlt/thelackthereof/content
          perl -pi -e 's/^updatedAt: .*/updatedAt: ${templateDate}/' "${existingFile}"
        `);
      });
    } else {
      const templateDate = options.date || exec("date '+%Y-%m-%d'");
      const fileDate = templateDate.replace(/-/g, '.');
      let newFilename;
      if (options.blog) {
        newFilename = `TLT - ${fileDate} - ${fileTitle}.md`;
      } else {
        newFilename = `${fileTitle}.md`;
      }

      let baseTemplateTags = options.tags;
      if (!baseTemplateTags && options.blog) {
        baseTemplateTags = 'blog';
      }

      // This is some crazy shell script escaping, FYI
      const templateTags = baseTemplateTags.split(',').map((tag: string) => `"'"'"${tag}"'"'"`).join(',');

      console.log(`Create/Edit page '${newFilename}'`);

      exec(`
        cd ~/tlt/thelackthereof/content
        cp -n "Page Template.md" "${newFilename}"
        perl -pi -e "s/TEMPLATE_TITLE/${title}/" "${newFilename}"
        perl -pi -e "s/TEMPLATE_DATE/${templateDate}/" "${newFilename}"
        perl -pi -e "s/TEMPLATE_TAGS/${templateTags}/" "${newFilename}"
      `);
      run('vim', [`/home/awwaiid/tlt/thelackthereof/content/${newFilename}`]);
    }
  });

program.command('drafts')
  .description('List draft pages')
  .action(() => {
    exec(`
      cd ~/tlt/thelackthereof/content
      rg -l '^draft: true' *.md | sort
    `, true);
  });

program.command('list')
  .alias('ls')
  .description('List pages')
  .option('-b, --blog', 'Blog posts')
  .action(() => {
    if (program.opts().blog) {
      exec(`
        cd ~/tlt/thelackthereof/content
        ls TLT*.md
      `, true);
    } else {
      exec(`
        cd ~/tlt/thelackthereof/content
        ls *.md
      `, true);
    }
  });

program.command('update-date')
  .description('Modify the date for a blog post')
  .argument('<title...>', 'blog post title')
  .action((titleList: string[]) => {
    const title = titleList.join(' ');
    const existingFile = findFile(title);
    let matches;
    if(matches = existingFile.match(/^TLT - (\d\d\d\d\.\d\d\.\d\d) - (.*).md$/)) {
      const originalTitle = matches[2];

      const fileDate = exec("date '+%Y.%m.%d'");
      const templateDate = exec("date '+%Y-%m-%d'");
      let newFilename = `TLT - ${fileDate} - ${originalTitle}.md`;

      exec(`
        cd ~/tlt/thelackthereof/content
        perl -pi -e 's/^createdAt: .*/createdAt: ${templateDate}/' "${existingFile}"
        perl -pi -e 's/^updatedAt: .*/updatedAt: ${templateDate}/' "${existingFile}"
        mv "${existingFile}" "${newFilename}"
      `);
    } else {
      console.log("Can't match date pattern for filename");
    }
  });


program.command('publish')
  .description("Update a page to be published with today's date")
  .argument('<title...>', 'page title')
  .action((titleList: string[]) => {
    const title = titleList.join(' ');

    const existingFile = findFile(title);

    if (existingFile) {
      const templateDate = exec("date '+%Y-%m-%d'");
      exec(`
        cd ~/tlt/thelackthereof/content
        perl -pi -e 's/draft: true//' "${existingFile}"
        perl -pi -e 's/^updatedAt: .*/updatedAt: ${templateDate}/' "${existingFile}"
      `);
    } else {
      console.log("File not found");
    }
  });

program.command('push')
  .alias('deploy')
  .description("Push page updates to server")
  .action(() => {
    console.log("Building and syncing...");
    exec(`
      cd ~/tlt/thelackthereof
      npm run deploy-dynamic || true
    `, true);
  });

program.parse(process.argv);
