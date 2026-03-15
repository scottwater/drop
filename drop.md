# What is Drop?

Drop is an application that allows an authenticated user to upload a file or
directory via one of two ways:

1. They can drop it onto a "drop zone" on a web page. 
2. Via the drop CLI

# What can you drop? 

Typically it would be a single HTML file or markdown document. However, it could
be a directory (with subdirectories for any file type)

# What happens with the files? 

Nothing. The files are not processed. They are simply copied to the backend
(likely an R2 bucket).

There is one notable exception. Any markdown file that is directly uploaded or
in a folder should have a corresponding HTML version. So test.md will also have
test.html. 


# A note on markdown to HTML

In addition to regular markdown, I want to be certain that when we convert
markdown to HTML, we properly handle frontmatter and show that as well.

Also, the HTML we generate should be properly styled and look good. I am open on
the theme, but I want the typography to be spectacular.

# Can files be overridden? 

Not without a confirmation. The CLI should have a parameter for this (--force or
--override) the web view should ask if you want to override the existing files.

# What about security 

You should be logged in (of have a token to add new files/etc.). However, for
non-authenticated users, as long as you have the link you should be able to view
the file/folder. 

If you are authenticated, there should be a list of available files to view
available. This list should not be visible or accessible to non-authenticated
users. 

# CLI details 

Anything you can do on the web, you should be able to do via the CLI.

# What about the stack 

I would like to try and make this a 100% CloudFlare application. Use R2 for
storage. Workers to process markdown to HTML, etc. I am not sure about the
authentication piece, but it feels possible even if we have to use a D2 database
or some version of key/values. 

Deployment should hopefully be as easy as wrangler deploy (or equivalent)
