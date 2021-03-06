// @flow

const { logger } = require('@lagoon/commons/src/local-logging');
const { sendToLagoonLogs } = require('@lagoon/commons/src/logs');
const { createDeployTask } = require('@lagoon/commons/src/tasks');

import type { WebhookRequestData, removeData, ChannelWrapper, Project } from '../types';

async function gitlabPullRequestUpdated(webhook: WebhookRequestData, project: Project) {

    const {
      webhooktype,
      event,
      giturl,
      uuid,
      body,
    } = webhook;

    const headBranchName = body.object_attributes.source_branch
    const headSha = body.object_attributes.last_commit.id
    const baseBranchName = body.object_attributes.target_branch
    const baseSha = `origin/${body.object_attributes.target_branch}` // gitlab does not send us the target sha, we just use the target_branch


    const data: deployData = {
      pullrequestTitle: body.object_attributes.title,
      pullrequestNumber: body.object_attributes.id,
      projectName: project.name,
      type: 'pullrequest',
      headBranchName: headBranchName,
      headSha: headSha,
      baseBranchName: baseBranchName,
      baseSha: baseSha,
      branchName: `pr-${body.object_attributes.id}`,
    }

    try {
      const taskResult = await createDeployTask(data);
      sendToLagoonLogs('info', project.name, uuid, `${webhooktype}:${event}:opened:handled`, data,
        `*[${project.name}]* PR <${body.object_attributes.url}|#${body.object_attributes.id} (${body.object_attributes.title})> updated in <${body.object_attributes.target.web_url}|${body.object_attributes.target.name}>`
      )
      return;
    } catch (error) {
      switch (error.name) {
        case "ProjectNotFound":
        case "NoActiveSystemsDefined":
        case "UnknownActiveSystem":
          // These are not real errors and also they will happen many times. We just log them locally but not throw an error
          sendToLagoonLogs('info', project.name, uuid, `${webhooktype}:${event}:handledButNoTask`, meta,
            `*[${project.name}]* PR ${body.object_attributes.id} opened. No remove task created, reason: ${error}`
          )
          return;

        default:
          // Other messages are real errors and should reschedule the message in RabbitMQ in order to try again
          throw error
      }
    }
}

module.exports = gitlabPullRequestUpdated;
