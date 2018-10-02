const { CircleCI } = require("./circle.js");


const {
  Markdown,
  h2,
  h3,
  h4,
  Link,
  Image,
  Gallery,
  P
} = require("./markdown.js");


async function makeBot(robot) {
  robot.log("Notebook bot is ready to go!!");
  robot.log.debug(process.env)
  //
  // Our requested permissions allow:
  //
  // * check_run
  // * check_suite
  // * pull_request
  //
  robot.on("check_suite", async context => {
    const { payload, event } = context;
    robot.log.debug(event);


    const { owner, repo } = context.repo();
    const { check_suite } = payload;


    // NOTE: check suites can have more than one pull request
    const { pull_requests, head_commit } = check_suite;
    if (pull_requests.length <= 0) {
      robot.log("no pull request for this check suite");
      // If there's no pull request, there's nothing we should do
      // ...erm, actually we can end up getting a check suite
      return;
    }
    // HACK: We'll operate on only the first of the pull requests for now...
    const pr = pull_requests[0];


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
    robot.log(`Searching for commit ${head_commit.id}`);
    const build = builds.find(build => build.vcs_revision === head_commit.id);
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
      h2("🎨"),
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
            Link(artifact.url, Image(artifact.url, artifact.pretty_path))
          )
      )
    );
    // Post an issue with the gallery!
    robot.log.debug("commenting with ", comment);
    await context.github.issues.createComment({
      owner,
      repo,
      number: pr.number,
      body: comment
    });
  });
}
module.exports = makeBot;
