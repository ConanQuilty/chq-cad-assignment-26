import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName, parseId, itemExists } from "../shared/db";
import { isResponse, parseJsonObject, response, serverError } from "../shared/http";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const body = parseJsonObject(event);
  if (isResponse(body)) return body;

  const movieId = parseId(String(body.movieId));
  const actorId = parseId(String(body.actorId));
  
  if (movieId === undefined || actorId === undefined) {
    return response(400, { message: "movieId and actorId must be positive integers" });
  }
  
  if (typeof body.roleName !== "string" || body.roleName === "" || typeof body.roleDescription !== "string" || body.roleDescription ===""){
    return response(400, { message: "roleName and roleDescription must be non-empty strings"}) 
  } 

  const role: Role = {
    movieId,
    actorId,
    roleName: body.roleName,
    roleDescription: body.roleDescription,
  };
  
  try {
    const movieExists = await itemExists(movieKey(movieId), movieKey(movieId));
    if (!movieExists) {
      return response(404, { message: `Movie ${movieId} not found` });
    }
  
    const actorExists = await itemExists(actorKey(actorId), actorKey(actorId));
    if (!actorExists) {
      return response(404, { message: `Actor ${actorId} not found` });
    }
  
    const roleExists = await itemExists(movieKey(movieId), actorKey(actorId));
    if (roleExists) {
      return response(409, {
        message: `Actor ${actorId} already has a role in movie ${movieId}`,
      });
    }

    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: movieKey(role.movieId), SK: movieKey(role.movieId) },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: actorKey(role.actorId), SK: actorKey(role.actorId) },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: { PK: movieKey(role.movieId), SK: actorKey(role.actorId), ...role },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      })
    );
    return response(201, { message: "Role added", data: role });
  } catch (err) {
    return serverError(err);
  }
};
