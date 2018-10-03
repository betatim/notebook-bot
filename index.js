const { CircleCI } = require("./circle.js");


const {
  Markdown,
  h2,
  h3,
  h4,
  Link,
  Image,
  Bullet,
  Gallery,
  P
} = require("./markdown.js");


async function makeBot(robot) {
  robot.log("Notebook bot is ready to go!!");
  //
  // Our requested permissions allow:
  //
  // * check_run
  // * check_suite
  // * pull_request
  //
  robot.on("status", async context => {
    const { payload, event } = context;
    //robot.log(event);


    const { owner, repo } = context.repo();
    const status_context = payload.context;
    const { state, commit } = payload;

    // When it's a finished check from CircleCI and it passes...
    robot.log("Wish for CircleCI to have check_suite or check_run integration");
    robot.log("Falling back on polling Circle CI");


    // HACK: Since CircleCI does not have check suites ready, we'll poll their API
    // For good measure, we'll wait to make sure that
    // * circle ci has created a build_num
    // * the build has finished (poll for this)
    const circle = new CircleCI(process.env.CIRCLE_CI_TOKEN, { owner, repo });


    // Assume, hopefully, that the check suite we are on is in the collection of builds
    // If a project is really big, this may not be the case 😬
    // We'll cross that bridge when we reach it!
    const builds = await circle.lastBuilds();
    // Find the first build with the matching commit id
    robot.log(`Searching for commit ${commit.sha}`);
    const build = builds.find(build => build.vcs_revision === commit.sha);
    if (!build) {
      robot.log.warn(
        `😬 No build found for ${
          head_commit.id
        }! Are there more builds than we can keep up with? 😬`
      );
      return;
    }
    robot.log(`It's build ${build.build_num}!`);
    // Get all the artifacts from Circle CI
    robot.log("Wish for artifacts from Circle CI");
    const artifacts = await circle.artifacts(build.build_num);
    if (!artifacts || artifacts.length <= 0) {
      robot.log.warn("no artifacts available");
      return;
    }
    robot.log(
      `Wish for Circle CI artifacts to not require being logged in to view them`
    );
    // Craft our message for users
    const comment = Markdown(
      h2("📚 Notebooks"),
      P("\n\n"),
      Gallery(
        artifacts
          .filter(
            artifact =>
              // Only HTML for now
              artifact.path.endsWith("html") &&
              // Only notebooks
              artifact.path.startsWith("notebooks")
          )
          // Link to the notebooks
          .map(artifact =>
            Bullet(Link(artifact.url, Image(artifact.url, artifact.pretty_path)))
          )
      )
    );
    const build_details = await circle.checkBuild(build.build_num);
    // only deal with the first PR if there are more
    // what to do if there is no PR?
    const pr_number = build_details.pull_requests[0].url.split("/").pop();

    // Post an issue with the gallery!
    robot.log("commenting with ", comment);
    await context.github.issues.createComment({
      owner,
      repo,
      number: pr_number,
      body: comment
    });
  });
}
module.exports = makeBot;
