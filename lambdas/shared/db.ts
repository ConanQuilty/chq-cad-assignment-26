import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { GetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);
export const tableName = process.env.TABLE_NAME!;

// Helper to check if an item exists
export const itemExists = async (PK: string, SK: string): Promise<boolean> => {
  const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK, SK } }));
  return result.Item !== undefined;
};

export * from './model';
