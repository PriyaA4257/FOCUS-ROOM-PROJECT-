import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRooms, createRoom } from "@workspace/api-client-react";
import { useAuthApi } from "@/hooks/use-auth-api";
import { Button, Card, Input, Label } from "@/components/ui";
import { Search, Plus, Users, Lock, Clock, Hash } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { formatTime } from "@/lib/utils";

export default function Rooms() {
  const { authHeaders } = useAuthApi();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["/api/rooms", search],
    queryFn: () => listRooms(search ? { search } : undefined, { headers: authHeaders }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createRoom(data, { headers: authHeaders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setIsCreateOpen(false);
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: fd.get("name") as string,
      category: fd.get("category") as string || "general",
      focusDuration: parseInt(fd.get("focusDuration") as string) || 25,
      breakDuration: parseInt(fd.get("breakDuration") as string) || 5,
      maxParticipants: parseInt(fd.get("maxParticipants") as string) || 10,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Explore Rooms</h1>
          <p className="text-muted-foreground text-lg">Find a space that matches your vibe.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="Search rooms..." 
              className="pl-10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <Dialog.Trigger asChild>
              <Button className="gap-2 shrink-0">
                <Plus size={18} /> Create Room
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
              <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]">
                <Card className="p-6">
                  <Dialog.Title className="text-2xl font-bold font-display mb-6">Create Study Room</Dialog.Title>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Room Name</Label>
                      <Input name="name" required placeholder="Deep Work Squad" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <select name="category" className="w-full h-12 rounded-xl border-2 border-border bg-background/50 px-4 text-sm text-foreground focus:outline-none focus:border-primary">
                          <option value="general">General</option>
                          <option value="coding">Coding</option>
                          <option value="reading">Reading</option>
                          <option value="writing">Writing</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Max Participants</Label>
                        <Input name="maxParticipants" type="number" defaultValue={10} min={2} max={50} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Focus Duration (min)</Label>
                        <Input name="focusDuration" type="number" defaultValue={25} min={5} max={90} />
                      </div>
                      <div className="space-y-2">
                        <Label>Break Duration (min)</Label>
                        <Input name="breakDuration" type="number" defaultValue={5} min={1} max={30} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Creating..." : "Create Room"}
                      </Button>
                    </div>
                  </form>
                </Card>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-secondary/30" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms?.map((room) => (
            <Card key={room.id} className="p-5 hover:border-primary/40 transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col cursor-pointer group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-md bg-secondary text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Hash size={12} />
                    {room.category}
                  </div>
                  {room.hasPassword && <Lock size={14} className="text-warning" />}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground bg-background/50 px-2 py-1 rounded-md">
                  <Users size={14} />
                  <span>{room.participantCount}/{room.maxParticipants}</span>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{room.name}</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1 line-clamp-2">
                Hosted by {room.hostUsername}
              </p>

              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-primary" />
                  <span className="text-white">{room.focusDuration}m / {room.breakDuration}m</span>
                </div>
                <Link href={`/rooms/${room.id}`}>
                  <Button variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    Join
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
          {rooms?.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <Search size={32} />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">No rooms found</h3>
              <p className="text-muted-foreground">Try a different search term or create your own room.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
