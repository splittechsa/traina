import { personalRecordsFromSessions, workoutElapsedSeconds } from '@sahhti/domain';
import type { Database } from '../db/database.js';
import { ApiError } from '../identity/accounts.js';
import { getSession } from './store.js';
export async function workoutResults(db:Database,userId:string,id:string){
  const session=await getSession(db,userId,id);
  if(session.status!=='completed'||!session.startedAt||!session.completedAt)throw new ApiError(409,'WORKOUT_NOT_COMPLETED','Complete this workout before viewing results');
  const best=personalRecordsFromSessions([session]);
  const previous=await db.query<{exercise_id:string;load_grams:number;reps:number}>(`SELECT DISTINCT ON (s.exercise_id) s.exercise_id,s.load_grams,s.reps
    FROM workout_sets s JOIN workout_sessions w ON w.id=s.session_id
    WHERE w.user_id=$1 AND w.status='completed' AND w.id<>$2 AND w.completed_at<=$3 AND s.exercise_id=ANY($4::uuid[])
    ORDER BY s.exercise_id,s.load_grams DESC,s.reps DESC,s.completed_at ASC,s.id ASC`,[userId,id,session.startedAt,best.map(row=>row.exerciseId)]);
  const comparisons=best.map(row=>{const prior=previous.rows.find(p=>p.exercise_id===row.exerciseId);return {exerciseId:row.exerciseId,loadGrams:row.loadGrams,reps:row.reps,previous:prior?{loadGrams:Number(prior.load_grams),reps:Number(prior.reps)}:null};});
  return {summary:{sets:session.sets.length,exercises:new Set(session.sets.map(set=>set.exerciseId)).size,volumeGrams:session.sets.reduce((sum,set)=>sum+set.reps*set.loadGrams,0),durationSeconds:workoutElapsedSeconds(session,session.completedAt)},
    comparisonBasis:'best_before_this_workout' as const,
    improvements:comparisons.filter(row=>row.previous&&(row.loadGrams>row.previous.loadGrams||(row.loadGrams===row.previous.loadGrams&&row.reps>row.previous.reps))),
    firstRecorded:comparisons.filter(row=>row.previous===null)};
}
