const R = require('ramda');
const { knex, whereAnd, prepare, query, inClauseOr } = require('./utils');

// This contains the sql query generation logic
const Sql = {
  updateProjectQuery: (cred, input) => {
    knex('project');
  },
};

const getAllProjects = sqlClient => async (cred, args) => {
  const { customers, projects } = cred.permissions;

  // We need one "WHERE" keyword, but we have multiple optional conditions
  const where = whereAnd([
    args.createdAfter ? 'created >= :createdAfter' : '',
    args.gitUrl ? 'git_url = :gitUrl' : '',
    ifNotAdmin(
      cred.role,
      inClauseOr([['customer', customers], ['project.id', projects]]),
    ),
  ]);

  const prep = prepare(sqlClient, `SELECT * FROM project ${where}`);
  const rows = await query(sqlClient, prep(args));

  return rows;
};

const getProjectByEnvironmentId = sqlClient => async (cred, eid) => {
  if (cred.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  const prep = prepare(
    sqlClient,
    `SELECT
        p.*
      FROM environment e
      JOIN project p ON e.project = p.id
      WHERE e.id = :eid
    `,
  );

  const rows = await query(sqlClient, prep({ eid }));

  return rows ? rows[0] : null;
};

const getProjectByGitUrl = sqlClient => async (cred, args) => {
  const { customers, projects } = cred.permissions;
  const str = `
      SELECT
        *
      FROM project
      WHERE git_url = :gitUrl
      ${ifNotAdmin(
        cred.role,
        `AND (${inClauseOr([
          ['customer', customers],
          ['project.id', projects],
        ])})`,
      )}
      LIMIT 1
    `;

  const prep = prepare(sqlClient, str);
  const rows = await query(sqlClient, prep(args));

  return rows ? rows[0] : null;
};

const getProjectByName = sqlClient => async (cred, args) => {
  const { customers, projects } = cred.permissions;
  const str = `
      SELECT
        *
      FROM project
      WHERE name = :name
      ${ifNotAdmin(
        cred.role,
        `AND (${inClauseOr([
          ['customer', customers],
          ['project.id', projects],
        ])})`,
      )}
    `;

  const prep = prepare(sqlClient, str);

  const rows = await query(sqlClient, prep(args));

  return rows[0];
};

const addProject = sqlClient => async (cred, input) => {
  const { customers } = cred.permissions;
  const cid = input.customer.toString();

  if (cred.role !== 'admin' && !R.contains(cid, customers)) {
    throw new Error('Project creation unauthorized.');
  }

  const prep = prepare(
    sqlClient,
    `CALL CreateProject(
        :id,
        :name,
        :customer,
        :git_url,
        :openshift,
        ${
          input.active_systems_deploy
            ? ':active_systems_deploy'
            : '"lagoon_openshiftBuildDeploy"'
        },
        ${
          input.active_systems_remove
            ? ':active_systems_remove'
            : '"lagoon_openshiftRemove"'
        },
        ${input.branches ? ':branches' : '"true"'},
        ${input.pullrequests ? ':pullrequests' : '"true"'},
        ${input.production_environment ? ':production_environment' : 'NULL'}
      );
    `,
  );

  const rows = await query(sqlClient, prep(input));
  const project = R.path([0, 0], rows);

  return project;
};

const deleteProject = sqlClient => async (cred, input) => {
  const { projects } = cred.permissions;
  const pid = input.id.toString();

  if (cred.role !== 'admin' && !R.contains(pid, projects)) {
    throw new Error('Unauthorized');
  }

  const prep = prepare(sqlClient, 'CALL DeleteProject(:id)');
  const rows = await query(sqlClient, prep(input));

  return 'success';
};

const updateProject = sqlClient => async (cred, input) => {
  const { projects } = cred.permissions;
  const { patch } = input;

  if (cred.role !== 'admin' && !R.contains(pid, projects)) {
    throw new Error('Unauthorized');
  }

  const query = Sql.updateProjectQuery(cred, input);

  const rows = await query(sqlClient, query);

  return rows;
};

const Queries = {
  deleteProject,
  addProject,
  getProjectByName,
  getProjectByGitUrl,
  getProjectByEnvironmentId,
  getAllProjects,
  updateProject,
};

module.exports = {
  Sql,
  Queries,
};
