"use client";

import { useEffect, useState } from "react";
import type { AggregatedFriendStat } from "@/lib/friends-data";
import { ListPagination } from "@/components/list-pagination";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayLevel } from "@/lib/rating";
import { PAGE_SIZE, slicePage } from "@/lib/paginate";
import { cn } from "@/lib/utils";

type FriendsLeaderboardTableProps = {
  leaderboard: AggregatedFriendStat[];
  currentUserId: string;
};

export function FriendsLeaderboardTable({
  leaderboard,
  currentUserId,
}: FriendsLeaderboardTableProps) {
  const [page, setPage] = useState(1);
  const {
    slice: rows,
    totalPages,
    startIndex,
    safePage,
  } = slicePage(leaderboard, page, PAGE_SIZE);
  const paginate = leaderboard.length > PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [leaderboard.length]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-border/60",
          !paginate && "max-h-[min(70vh,44rem)] overflow-auto",
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Skill</TableHead>
              <TableHead className="text-right">Games</TableHead>
              <TableHead className="text-right">Wins</TableHead>
              <TableHead className="text-right">Court 1</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              const rank = startIndex + idx + 1;
              return (
                <TableRow key={row.player_id}>
                  <TableCell className="text-muted-foreground">{rank}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-3">
                      <UserAvatarDisplay
                        name={row.name}
                        username={row.username}
                        avatarUrl={row.avatar_url}
                        size="sm"
                      />
                      <span className="font-medium">{row.name}</span>
                      {row.user_id === currentUserId ? (
                        <Badge variant="secondary">You</Badge>
                      ) : null}
                      {row.username ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          @{row.username}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    Lv {formatDisplayLevel(row.skill)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_games}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_wins}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.court1_wins}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_points}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {paginate ? (
        <ListPagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </>
  );
}
